/* eslint-disable prettier/prettier */

import { IsArray, IsBoolean, IsEmail,  IsNotEmpty,   IsNumber,   IsOptional,   IsPositive,   IsString } from "class-validator";
import { awardsEntry, CaseEntry, educationEntry, membershipEntry } from "src/types";


export class AttorneySignUpDTO {
    @IsNotEmpty()
    attorneyType: 'solo' | 'Firm-wide (≤20 attorneys)' | 'Firm-wide (>20 attorneys)'

    @IsNotEmpty()
    @IsString()
    firstName: string

    @IsNotEmpty()
    @IsString()
    lastName: string

    @IsNotEmpty()
    @IsString()
    firmName: string



    @IsNotEmpty()
    @IsString()
    firmAddress: string

    @IsNotEmpty()
    @IsString()
    state: string

    @IsNotEmpty()
    @IsString()
    zipCode: string

    @IsEmail()
    @IsString()
    @IsNotEmpty()
    email: string

    @IsNotEmpty()
    @IsString()
    phoneNumber: string;
    


    @IsNotEmpty()
    @IsArray()
    statesLicensing: Array<{
        state: string;
        barLicenseNumber: string;
    }>;
    
    @IsNotEmpty()
    @IsArray()
    areasOfPractice:string[]

    @IsBoolean()
    @IsNotEmpty()
    isAgreed: boolean

    @IsNotEmpty()
    @IsString()
    cognitoId:string


    @IsNotEmpty()
    @IsArray()
    countiesSubscribed: string[]

    @IsOptional()
    zipCodesSubscribed: Record<string, string[]>

    @IsNumber()
    @IsNotEmpty()
    @IsPositive()
    normalPrice: number
    

    
 @IsOptional() 
  waitlistPosition?: number;


  @IsOptional()
  @IsString()
  subscription_status?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  profile_picture_url?: string;

  @IsOptional()
  @IsArray()
  education?: educationEntry[]

  @IsOptional()
  @IsArray()
  memberships?: membershipEntry[];

  @IsOptional()
  @IsArray()
  awards?: awardsEntry[];

  @IsOptional()
  @IsArray()
  specializations?: string[];

  @IsOptional()
  @IsArray()
  representative_cases?: CaseEntry[];

  @IsOptional()
  @IsNumber()
  hourly_rate?: number;

  @IsOptional()
  @IsBoolean()
  pro_bono_available?: boolean;

  @IsOptional()
  @IsString()
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

