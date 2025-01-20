/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from 'src/supabase/supabase.service';
import { DiscountTier } from 'src/types';

@Injectable()
export class DiscountService {
    private supabaseClient: SupabaseClient;
    private readonly logger = new Logger(DiscountService.name);
    private readonly DISCOUNT_TIERS = {
        TIER_1: {
            maxPosition: 1000,
            trialMonths: 12,
            secondYearDiscount: 50
        },
        TIER_2: {
            maxPosition: 2500,
            trialMonths: 12,
            secondYearDiscount: 25
        },
        TIER_3: {
            trialMonths: 6,
            secondYearDiscount: 0,
            additionalDiscount: {
                percent: 50,
                months: 6
            }
        }
    };
    
    constructor(private supabaseService: SupabaseService) {
        this.supabaseClient = supabaseService.getClient();
        this.logger.log('DiscountService initialized');
    }

    private getDiscountTier(position: number): DiscountTier {
        this.logger.debug(`Determining discount tier for position: ${position}`);
        
        let tier: DiscountTier;
        if (position <= this.DISCOUNT_TIERS.TIER_1.maxPosition) {
            tier = this.DISCOUNT_TIERS.TIER_1;
            this.logger.debug(`Position ${position} qualifies for TIER_1`);
        } else if (position <= this.DISCOUNT_TIERS.TIER_2.maxPosition) {
            tier = this.DISCOUNT_TIERS.TIER_2;
            this.logger.debug(`Position ${position} qualifies for TIER_2`);
        } else {
            tier = this.DISCOUNT_TIERS.TIER_3;
            this.logger.debug(`Position ${position} qualifies for TIER_3`);
        }

        this.logger.debug('Tier details:', { tier });
        return tier;
    }

    async getAttorneyTier(email: string, barLicenses: string[]) {
        this.logger.log('Getting attorney tier', { email, barLicenses });

        try {
            this.logger.debug('Querying waitlist table for user');
            const { data: waitlistUser, error: waitlistError } = await this.supabaseClient
                .from('waitlist')
                .select('waitlist_position, licenses')
                .eq('email', email)
                .single();

            if (waitlistError) {
                this.logger.error('Error querying waitlist table', { 
                    error: waitlistError.message,
                    details: waitlistError 
                });
                throw new Error(waitlistError.message);
            }

            if (!waitlistUser) {
                this.logger.debug('No waitlist entry found for email:', email);
                return null;
            }

            this.logger.debug('Waitlist user found', { 
                waitlistPosition: waitlistUser.waitlist_position,
                waitlistLicenses: waitlistUser.licenses 
            });

            const licenses = waitlistUser.licenses;
            this.logger.debug("bar licenses from signUp", barLicenses)
            const hasMatchingLicense = barLicenses.some((license) => licenses.includes(license));
            
            this.logger.debug('License matching result', {
                providedLicenses: barLicenses,
                waitlistLicenses: licenses,
                hasMatch: hasMatchingLicense
            });

            if (hasMatchingLicense) {
                const tier = this.getDiscountTier(waitlistUser.waitlist_position);
                this.logger.log('Determined attorney tier', { 
                    email,
                    position: waitlistUser.waitlist_position,
                    tier 
                });
                return tier;
            } else {
                this.logger.debug('No matching license found, returning null');
                return null;
            }
        } catch (error) {
            this.logger.error('Error in getAttorneyTier', {
                error: error.message,
                stack: error.stack,
                email,
                barLicenses
            });
            throw new Error(error.message);
        }
    }
}