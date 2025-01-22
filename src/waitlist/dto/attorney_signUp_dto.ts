/* eslint-disable prettier/prettier */
import { Type } from 'class-transformer';
import { 
    IsArray, 
    IsBoolean, 
    IsEmail, 
    IsEnum, 
    IsNotEmpty, 
    IsNumber, 
    IsObject, 
    IsOptional, 
    IsPhoneNumber, 
    IsPositive, 
    IsString, 
    ValidateNested,
    MinLength,
    MaxLength,
    Matches,
    ArrayMinSize
} from 'class-validator';
import { awardsEntry, CaseEntry, educationEntry, membershipEntry } from '../../types';

export enum AttorneyType {
    SOLO = 'solo',
    SMALL_FIRM = 'Firm-wide (≤20 attorneys)',
    LARGE_FIRM = 'Firm-wide (>20 attorneys)'
}

class StateLicense {
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(2)
    state: string;

    @IsString()
    @IsNotEmpty()
    barLicenseNumber: string;
}

class Education implements educationEntry {
    @IsString()
    @IsNotEmpty()
    institution_name: string;

    @IsString()
    @IsNotEmpty()
    degree_name: string;

    @IsNumber()
    @IsPositive()
    year_of_degree: number;
}

class Membership implements membershipEntry {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    year_of_entry: number;

    @IsNumber()
    @IsPositive()
    year_of_end: number;
}

class Award implements awardsEntry {
    @IsString()
    @IsNotEmpty()
    name_of_award: string;

    @IsNumber()
    @IsPositive()
    year_of_award: number;

   
}

class Case implements CaseEntry {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(10)
    description: string;

   
}

export class AttorneySignUpDTO {
    @IsNotEmpty()
    @IsEnum(AttorneyType)
    attorneyType: AttorneyType;

    @IsNotEmpty()
    @IsString()
    @MinLength(2)
    firstName: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(2)
    lastName: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(2)
    firmName: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(5)
    firmAddress: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(2)
    @MaxLength(2)
    state: string;

    @IsNotEmpty()
    @IsString()
    zipCode: string;

    @IsEmail()
    @IsString()
    @IsNotEmpty()
    email: string;

    @IsNotEmpty()
    @IsPhoneNumber('US')
    phoneNumber: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StateLicense)
    @ArrayMinSize(1)
    statesLicensing: StateLicense[];

    @IsArray()
    @IsString({ each: true })
    @ArrayMinSize(1)
    areasOfPractice: string[];

    @IsBoolean()
    @IsNotEmpty()
    isAgreed: boolean;

    @IsNotEmpty()
    @IsString()
    cognitoId: string;

    @IsArray()
    @IsString({ each: true })
    @ArrayMinSize(1)
    countiesSubscribed: string[];

    @IsObject()
    @IsOptional()
    zipCodesSubscribed?: Record<string, string[]>;

    @IsNumber()
    @IsNotEmpty()
    @IsPositive()
    normalPrice: number;

    @IsOptional()
    @IsNumber()
    waitlistPosition?: number;

    @IsOptional()
    @IsString()
    subscription_status?: string;

    @IsOptional()
    @IsString()
    @MinLength(10)
    bio?: string;

    @IsOptional()
    @IsString()
    @Matches(/^https?:\/\/.+/, {
        message: 'Profile picture URL must be a valid URL'
    })
    profile_picture_url?: string;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => Education)
    education?: Education[];

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => Membership)
    memberships?: Membership[];

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => Award)
    awards?: Award[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    specializations?: string[];

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => Case)
    representative_cases?: Case[];

    @IsOptional()
    @IsNumber()
    @IsPositive()
    hourly_rate?: number;

    @IsOptional()
    @IsBoolean()
    pro_bono_available?: boolean;

    @IsOptional()
    @IsString()
    @MinLength(10)
    why_joined_LR?: string;

    @IsOptional()
    @IsBoolean()
    newCaseNotifications?: boolean;

    @IsOptional()
    @IsBoolean()
    messageNotifications?: boolean;

    @IsOptional()
    @IsBoolean()
    platformUpdateNotifications?: boolean;
}
