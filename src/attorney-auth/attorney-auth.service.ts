/* eslint-disable prettier/prettier */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { DiscountService } from 'src/discount/discount.service';
import { StripeService } from 'src/stripe/Stripe.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import { AttorneySignUpDTO } from 'src/waitlist/dto/attorney_signUp_dto';
import { UpdateAttorneyDto } from 'src/waitlist/dto/attorney_Update_dto copy';


const TABLES = {
  WAITLIST: 'waitlist',
  ATTORNEY_USERS: 'attorneyUsers',
} as const;

@Injectable()
export class AttorneyAuthService {
  private readonly logger = new Logger(AttorneyAuthService.name);
  private readonly supabaseClient: SupabaseClient;

  constructor(private readonly supabaseService: SupabaseService,
    private readonly discountService: DiscountService,
    private readonly stripeService: StripeService

  ) {
    this.supabaseClient = supabaseService.getClient();
  }

 
  async signUpAttorney(data: AttorneySignUpDTO) {
    const { email, normalPrice } = data;

    try {
      // Check waitlist status
      const { data: waitlistUsers, error: waitlistError } = await this.supabaseClient
        .from(TABLES.WAITLIST)
        .select('*')
        .eq('email', email)
       

      if (waitlistError) {
        this.logger.error(`Error retrieving user from waitlist: ${waitlistError.message}`);
        throw new Error(`Failed to check waitlist status: ${waitlistError.message}`);
      }
 

      
      const signupData = {
        ...data,
        
      };

   
      

      // Create new attorney user
      const { data: newUser, error: newUserError } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .insert([signupData])
        .select('*')
        .single();

      if (newUserError) {
        this.logger.error(`Error creating new user: ${newUserError.message}`);
        throw new Error(`Failed to create attorney user: ${newUserError.message}`);
      }


      //create new subscription
      const attorneyId = newUser.id 
      if(waitlistUsers){
       const Licenses = data.statesLicensing.map((license) => license.barLicenseNumber)
       
       const attorneyTier =  await this.discountService.getAttorneyTier(email, Licenses as unknown as string[] )
       if(!attorneyTier){
        throw new Error("the licenses do not much the details on the waitlist")
       }
       
       const session = await this.stripeService.createCheckoutSession(
        normalPrice,
        attorneyTier,
        email,
        attorneyId
       )
       return {newUser, url: session.url }

      }else{
        const attorneyTier = null
        const sessionUrl = this.stripeService.createCheckoutSession(
          normalPrice,
          attorneyTier,
          email,
          attorneyId
         )
         return {newUser, sessionUrl}

      }


      
    } catch (error) {
      this.logger.error(`SignUp process failed: ${error.message}`);
      throw error;
    }
    



  }

 
  async signInAttorney(email: string) {
    try {
      const { data: attorneyUser, error } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        this.logger.error(`Error retrieving attorney: ${error.message}`);
        throw new Error(`Failed to retrieve attorney: ${error.message}`);
      }

      if (!attorneyUser) {
        throw new NotFoundException('Attorney user not found');
      }

      return attorneyUser;
    } catch (error) {
      this.logger.error(`SignIn process failed: ${error.message}`);
      throw error;
    }
  }


  async updateAttorneyDetails(email: string, data: UpdateAttorneyDto) {
    try {
      // Verify attorney exists
      const { data: attorneyExists, error: checkError } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .select('*')
        .eq('email', email)
        .single();

      if (checkError) {
        this.logger.error(`Error checking attorney existence: ${checkError.message}`);
        throw new Error(`Failed to verify attorney: ${checkError.message}`);
      }

      if (!attorneyExists) {
        throw new NotFoundException('Attorney user not found');
      }

      // Update attorney details
      const { data: updatedUser, error: updateError } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .update(data)
        .eq('email', email)
        .select('*')
        .single();

      if (updateError) {
        this.logger.error(`Error updating attorney: ${updateError.message}`);
        throw new Error(`Failed to update attorney: ${updateError.message}`);
      }

      return updatedUser;
    } catch (error) {
      this.logger.error(`Update process failed: ${error.message}`);
      throw error;
    }
  }

  
  async deleteAttorney(email: string): Promise<string> {
    try {
      // Verify attorney exists
      const { data: attorneyExists, error: checkError } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .select('*')
        .eq('email', email)
        .single();

      if (checkError) {
        this.logger.error(`Error checking attorney existence: ${checkError.message}`);
        throw new Error(`Failed to verify attorney: ${checkError.message}`);
      }

      if (!attorneyExists) {
        throw new NotFoundException('Attorney user not found');
      }

      // Delete attorney
      const { error: deleteError } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .delete()
        .eq('email', email);

      if (deleteError) {
        this.logger.error(`Error deleting attorney: ${deleteError.message}`);
        throw new Error(`Failed to delete attorney: ${deleteError.message}`);
      }
      return 'Attorney user deleted'
    } catch (error) {
      this.logger.error(`Delete process failed: ${error.message}`);
      throw error;
    }
  }
}