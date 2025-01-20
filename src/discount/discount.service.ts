/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from 'src/supabase/supabase.service';
import { DiscountTier } from 'src/types';

@Injectable()
export class DiscountService {
    private supabaseClient: SupabaseClient;
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
    }

    private getDiscountTier(position: number):DiscountTier {
        if (position <= this.DISCOUNT_TIERS.TIER_1.maxPosition) {
            return this.DISCOUNT_TIERS.TIER_1;
        } else if (position <= this.DISCOUNT_TIERS.TIER_2.maxPosition) {
            return this.DISCOUNT_TIERS.TIER_2;
        } else {
            return this.DISCOUNT_TIERS.TIER_3;
        }
    }

    async getAttorneyTier(email: string, barLicenses: string[]) {
        try {
            const { data: waitlistUser, error: waitlistError } = await this.supabaseClient
                .from('waitlist')
                .select('waitlistPosition, Licenses')
                .eq('email', email)
                .single();

            if (waitlistError) {
                throw new Error(waitlistError.message);
            }

            if (!waitlistUser) {
                return null;
            }

            const licenses = waitlistUser.Licenses;
            const hasMatchingLicense = barLicenses.some((license) => licenses.includes(license));

            if (hasMatchingLicense) {
                return this.getDiscountTier(waitlistUser.waitlistPosition);
            } else {
                return null;
            }
        } catch (error) {
            throw new Error(error.message);
        }
    }
}