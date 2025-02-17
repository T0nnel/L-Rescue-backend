/* eslint-disable prettier/prettier */
import {  PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

import { DiscountService } from 'src/discount/discount.service';
import { StripeService } from 'src/stripe/Stripe.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import { AttorneySignUpDTO } from 'src/waitlist/dto/attorney_signUp_dto';
import { UpdateAttorneyDto } from 'src/waitlist/dto/attorney_Update_dto copy';
import { Express } from 'express';

const TABLES = {
  WAITLIST: 'waitlist',
  ATTORNEY_USERS: 'attorneys',
} as const;

@Injectable()
export class AttorneyAuthService {
  private readonly logger = new Logger(AttorneyAuthService.name);
  private readonly supabaseClient: SupabaseClient;
  private s3: S3Client;
  private bucketName = process.env.S3_BUCKET_NAME;


  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly discountService: DiscountService,
    private readonly stripeService: StripeService,

  ) {
    this.supabaseClient = supabaseService.getClient();
   
      this.s3 = new S3Client({
        region: process.env.REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
    }

  private parseJsonField(field: string): any {
    try {
      return JSON.parse(field);
    } catch (error) {
      this.logger.error(`Failed to parse JSON field: ${error.message}`, {
        field,
      });
      return null;
    }
  }

  async signUpAttorney(data: AttorneySignUpDTO) {
    const { email } = data;

    const existingAttorney = await this.findAttorneyByEmail(email);
    if (existingAttorney) {
      this.logger.warn('Attorney with this email already exists', { email });
      throw new ConflictException('An attorney with this email already exists');
    }

    try {
      const newUser = await this.createAttorneyUser(data);
      return newUser;
    } catch (error) {
      this.logger.error(`SignUp process failed: ${error.message}`, {
        error,
        email,
      });
      throw error;
    }
  }

  async registerAttorneySubscription(
    email: string,
    id: string,
    normalPrice: number,
    statesLicensing: { barLicenseNumber: string }[],
  ) {
    const waitlistUsers = await this.checkWaitlistStatus(email);
    const subscriptionData = await this.createSubscription(
      email,
      id,
      normalPrice,
      statesLicensing,
      waitlistUsers,
    );


    return subscriptionData;
  }

 

  async getAttorneyData(email: string) {
    try {
 
      const attorney = await this.findAttorneyByEmail(email);

      if (!attorney) {
        throw new NotFoundException('Attorney user not found');
      }

      const { data: subscription, error: subscriptionError } = await this.supabaseClient
        .from('attorney_subscriptions')
        .select('*')
        .eq('attorneyId', attorney.id)
        .single();

      if (subscriptionError && subscriptionError.code !== 'PGRST116') { 
        throw subscriptionError;
      }

     
      return {
        ...attorney,
        subscription: subscription || null
      };
    } catch (error) {
      throw error;
    }
  }

  async updateAttorneyDetails(email: string, data: UpdateAttorneyDto) {
    try {
      // Verify attorney exists
      const attorney = await this.findAttorneyByEmail(email);
      if (!attorney) {
        throw new NotFoundException('Attorney user not found');
      }

      // Update attorney details
      const updatedUser = await this.updateAttorneyUser(email, data);
      return updatedUser;
    } catch (error) {
      this.logger.error(`Update process failed: ${error.message}`, {
        email,
        data,
      });
      throw error;
    }
  }

  async uploadImage(file: Express.Multer.File, attorneyId: string, email: string) {
    const attorney = await this.findAttorneyByEmail(email)
    if(!attorney){
      throw new NotFoundException('Attorney with the email was not found')
    }
    const fileName = `profile-images/${attorneyId}.jpg`; 
    const params = {
      Bucket: this.bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      
    };
  
    await this.s3.send(new PutObjectCommand(params));
    const url = `https://${this.bucketName}.s3.amazonaws.com/${fileName}`
    const data = {profile_picture_url: url }

    await this.updateAttorneyDetails(email, data)
  
    return {
      imageUrl: url,
      fileName,
    };
  }
  

  async deleteAttorney(email: string): Promise<string> {
    try {
      const attorney = await this.findAttorneyByEmail(email);
      if (!attorney) {
        throw new NotFoundException('Attorney user not found');
      }

      await this.deleteAttorneyUser(email);
      return 'Attorney user deleted successfully';
    } catch (error) {
      this.logger.error(`Delete process failed: ${error.message}`, { email });
      throw error;
    }
  }

  async findAttorneyByEmail(email: string) {
    const { data, error } = await this.supabaseClient
      .from(TABLES.ATTORNEY_USERS)
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check attorney existence: ${error.message}`);
    }

    return data;
  }

  private async createAttorneyUser(data: AttorneySignUpDTO) {
    const { data: newUser, error } = await this.supabaseClient
      .from(TABLES.ATTORNEY_USERS)
      .insert([data])
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Error creating new user: ${error.message}`, { data });
      throw new Error(`Failed to create attorney user: ${error.message}`);
    }

    return newUser;
  }

  private async updateAttorneyUser(email: string, data: UpdateAttorneyDto) {
    const { data: updatedUser, error } = await this.supabaseClient
      .from(TABLES.ATTORNEY_USERS)
      .update(data)
      .eq('email', email)
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Error updating attorney: ${error.message}`, {
        email,
        data,
      });
      throw new Error(`Failed to update attorney: ${error.message}`);
    }

    return updatedUser;
  }

  private async checkWaitlistStatus(email: string) {
    const { data, error } = await this.supabaseClient
      .from(TABLES.WAITLIST)
      .select('*')
      .eq('email', email);

    if (error) {
      this.logger.error(
        `Error retrieving user from waitlist: ${error.message}`,
        { email },
      );
      throw new Error(`Failed to check waitlist status: ${error.message}`);
    }

    return data;
  }

  private async deleteAttorneyUser(email: string) {
    const { error } = await this.supabaseClient
      .from(TABLES.ATTORNEY_USERS)
      .delete()
      .eq('email', email);

    if (error) {
      this.logger.error(`Error deleting attorney: ${error.message}`, { email });
      throw new Error(`Failed to delete attorney: ${error.message}`);
    }
  }

  async getAllAttorneys(params: {
    page: number;
    limit: number;
    state?: string;
    practiceArea?: string;
    accountType?: string;
    subscriptionStatus?: string;
    isActive?: boolean;
    sortBy?: string;
  }) {
    const {
      page = 1,
      limit = 10,
      state,
      practiceArea,
      accountType,
      subscriptionStatus,
      isActive,
      sortBy,
    } = params;

    const offset = (page - 1) * limit;

    let query = this.supabaseClient.from(TABLES.ATTORNEY_USERS).select(
      `
      id,
      attorneyType,
      firstName,
      lastName,
      firmName,
      firmAddress,
      state,
      zipCode,
      email,
      phoneNumber,
      statesLicensing::json,
      areasOfPractice::json,
      isAgreed,
      countiesSubscribed::json,
      zipCodesSubscribed::json,
      normalPrice,
      waitlistPosition,
      subscription_status,
      bio,
      profile_picture_url,
      education,
      memberships,
      awards,
      specializations,
      representative_cases,
      hourly_rate,
      pro_bono_available,
      why_joined_LR,
      newCaseNotifications,
      messageNotifications,
      platformUpdateNotifications,
      cognitoId,
      isActive
    `,
      { count: 'exact' },
    );
    if (state) {
      query = query.contains('statesLicensing', [{ state }]);
    }

    if (practiceArea) {
      query = query.contains('areasOfPractice', [practiceArea]);
    }

    if (accountType) {
      query = query.eq('attorneyType', accountType);
    }

    if (subscriptionStatus) {
      query = query.eq('subscription_status', subscriptionStatus);
    }

    if (isActive !== undefined) {
      query = query.eq('isActive', isActive);
    }

    // Handle different sort options
    switch (sortBy) {
      case 'attorneyType':
        query = query.order('attorneyType');
        break;
      case 'subscriptionStatus':
        query = query.order('subscription_status');
        break;
      case 'lastActive':
        query = query.order('last_active_at', { ascending: false });
        break;
      default:
        query = query.order('lastName');
    }

    query = query.range(offset, offset + limit - 1);

    const { data: attorneys, error, count } = await query;

    if (error) {
      this.logger.error(`Failed to fetch attorneys: ${error.message}`);
      throw new Error('Failed to fetch attorneys');
    }

    return {
      attorneys,
      metadata: {
        currentPage: page,
        itemsPerPage: limit,
        totalPages: Math.ceil(count / limit),
        totalAttorneys: count,
        hasNextPage: offset + limit < count,
        hasPreviousPage: page > 1,
        filters: {
          accountType,
          subscriptionStatus,
          isActive,
          state,
          practiceArea,
        },
        sortBy,
      },
    };
  }

  async getAttorneyById(id: string): Promise<AttorneySignUpDTO> {
    const { data: attorney, error } = await this.supabaseClient
      .from(TABLES.ATTORNEY_USERS)
      .select()
      .eq('id', id)
      .single();

    if (error) {
      this.logger.error(`Failed to fetch attorney: ${error.message}`);
      throw new NotFoundException(`Attorney with id ${id} not found`);
    }
    const attorneyWithParsedData = {
      ...attorney,
      statesLicensing: this.parseJsonField(attorney.statesLicensing),
      countiesSubscribed: this.parseJsonField(attorney.countiesSubscribed),
      areasOfPractice: this.parseJsonField(attorney.areasOfPractice),
      zipCodesSubscribed: this.parseJsonField(attorney.zipCodesSubscribed),
      education: this.parseJsonField(attorney.education),
      memberships: this.parseJsonField(attorney.memberships),
      awards: this.parseJsonField(attorney.awards),
    };

    return attorneyWithParsedData;
  }

  private async createSubscription(
    email: string,
    attorneyId: string,
    normalPrice: number,
    statesLicensing: Array<{ barLicenseNumber: string }>,
    waitlistUsers: any[],
  ) {
    let attorneyTier = null;

    if (waitlistUsers.length > 0) {
      const licenses = statesLicensing.map(
        (license) => license.barLicenseNumber,
      );
      attorneyTier = await this.discountService.getAttorneyTier(
        email,
        licenses,
      );

      if (!attorneyTier) {
        this.logger.error('License mismatch with waitlist', {
          email,
          licenses,
        });
        throw new Error(
          'The licenses do not match the details on the waitlist',
        );
      }
    }

    const session = await this.stripeService.createCheckoutSession(
      normalPrice,
      attorneyTier,
      email,
      attorneyId,
    );

    return { newUser: attorneyId, url: session.url };
  }
}
