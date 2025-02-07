/* eslint-disable prettier/prettier */

export interface educationEntry{
    institution_name: string,
    degree_name: string,
    year_of_degree: number
}

export interface membershipEntry {
    name: string,
    year_of_entry: number,
    year_of_end: number
}

export interface awardsEntry{
    name_of_award: string,
    year_of_award: number
}

export interface CaseEntry {
    title: string,
    description: string

}



export interface AttorneyProfile {
    id: string,
    email: string,
    status: 'approved' | 'declined'
    first_name: string,
    last_name:string,
    firm_name: string,
    firm_address: string,
    firm_zip: string,
    phone_number: string
    membership_type: 'solo' | 'firm_wide( <=20)' | 'firm_wide (> 20)'
    subscription_status: string,


    bio: string,
    profile_picture_url: string,
    education: educationEntry[],
    memberships: membershipEntry[],
    awards: awardsEntry[],
    specializations: string[],
    representative_cases: CaseEntry[],
    hourly_rate: number,
    pro_bono_available: boolean,
    why_joined_LR: string,
    waitlist_position?: number
    createdAt: string,
    updatedAt: string
}



// Types for subscription status tracking
export interface AttorneySubscription {
    id: string;
    attorneyId: string;
    stripeSubscriptionId: string;
    discountTier: DiscountTier;
    subscriptionStatus: 'trial' | 'discounted' | 'full';
    trialEndsAt: Date;
    discountEndsAt: Date | null;
    discountPercent: number;
    basePrice: number;
    currentPrice: number;
    nextPriceChange: Date | null;
    nextPrice: number | null;
    originalBasePrice?: number;
  }

export type DiscountTier = {
    maxPosition?: number; 
    trialMonths: number;
    secondYearDiscount: number;
    additionalDiscount?: {
        percent: number;
        months: number;
    };
};

export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string | null;
  scopes: string[];
}

export interface ApplePrivateKeyConfig {
  teamId: string;
  keyId: string;
  privateKeyPath: string;
  clientId: string;
}
