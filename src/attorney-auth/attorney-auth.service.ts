/* eslint-disable prettier/prettier */
import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
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

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly discountService: DiscountService,
        private readonly stripeService: StripeService
    ) {
        this.supabaseClient = supabaseService.getClient();
    }

    async signUpAttorney(data: AttorneySignUpDTO) {
        const { email} = data;

      
        const existingAttorney = await this.findAttorneyByEmail(email);
        if (existingAttorney) {
            this.logger.warn('Attorney with this email already exists', { email });
            throw new ConflictException('An attorney with this email already exists');
        }

        try {         
            const newUser = await this.createAttorneyUser(data);
            return newUser    
        } catch (error) {
            this.logger.error(`SignUp process failed: ${error.message}`, {
                error,
                email,
               
            });
            throw error;
        }
    }

    async registerAttorneySubscription(email: string, id: string, normalPrice: number, statesLicensing: { barLicenseNumber: string; }[]) {
        const waitlistUsers = await this.checkWaitlistStatus(email);
        const subscriptionData = await this.createSubscription(
            email,
            id,
            normalPrice,
            statesLicensing,
            waitlistUsers
        );

        await this.supabaseClient.from(TABLES.ATTORNEY_USERS).update({'normalPrice': normalPrice}).eq('email', email);

        return subscriptionData;

    }

    async signInAttorney(email: string) {
        try {
            const attorney = await this.findAttorneyByEmail(email);
            
            if (!attorney) {
                this.logger.warn('Attorney not found during signin', { email });
                throw new NotFoundException('Attorney user not found');
            }

            return attorney;
        } catch (error) {
            this.logger.error(`SignIn process failed: ${error.message}`, { email });
            throw error;
        }
    }

    async updateAttorneyDetails(email: string, data: UpdateAttorneyDto) {
        try {
            // Verify attorney exists
            const attorney = await this.findAttorneyByEmail(email);
            if (!attorney) {
                this.logger.warn('Attorney not found during update', { email });
                throw new NotFoundException('Attorney user not found');
            }

            // Update attorney details
            const updatedUser = await this.updateAttorneyUser(email, data);
            return updatedUser;
        } catch (error) {
            this.logger.error(`Update process failed: ${error.message}`, { email, data });
            throw error;
        }
    }

    async deleteAttorney(email: string): Promise<string> {
        try {
          
            const attorney = await this.findAttorneyByEmail(email);
            if (!attorney) {
                this.logger.warn('Attorney not found during deletion', { email });
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
            .select('email')
            .eq('email', email)
            .maybeSingle();

        if (error) {
            this.logger.error(`Error checking attorney existence: ${error.message}`, { email });
            throw new Error(`Failed to check attorney existence: ${error.message}`);
        }

        return data;
    }

 

    private async checkWaitlistStatus(email: string) {
        const { data, error } = await this.supabaseClient
            .from(TABLES.WAITLIST)
            .select('*')
            .eq('email', email);

        if (error) {
            this.logger.error(`Error retrieving user from waitlist: ${error.message}`, { email });
            throw new Error(`Failed to check waitlist status: ${error.message}`);
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
            this.logger.error(`Error updating attorney: ${error.message}`, { email, data });
            throw new Error(`Failed to update attorney: ${error.message}`);
        }

        return updatedUser;
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

    private async createSubscription(
        email: string,
        attorneyId: string,
        normalPrice: number,
        statesLicensing: Array<{ barLicenseNumber: string }>,
        waitlistUsers: any[]
    ) {
        let attorneyTier = null;

        if (waitlistUsers.length > 0) {
            const licenses = statesLicensing.map((license) => license.barLicenseNumber);
            attorneyTier = await this.discountService.getAttorneyTier(email, licenses);
            
            if (!attorneyTier) {
                this.logger.error('License mismatch with waitlist', { email, licenses });
                throw new Error('The licenses do not match the details on the waitlist');
            }
        }

        const session = await this.stripeService.createCheckoutSession(
            normalPrice,
            attorneyTier,
            email,
            attorneyId
        );

        return { newUser: attorneyId, url: session.url };
    }
}