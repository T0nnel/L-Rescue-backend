/* eslint-disable prettier/prettier */
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateCaseDto {
  @IsString()
  legalCategory: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  county?: string;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsString()
  age?: string;

  @IsOptional()
  @IsArray()
  maritalStatus?: string[];

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsArray()
  relationship?: string[];

  @IsOptional()
  @IsArray()
  custodyStatus?: string[];

  @IsOptional()
  @IsArray()
  biologicalMotherPosition?: string[];

  @IsOptional()
  @IsArray()
  biologicalFatherPosition?: string[];

  @IsOptional()
  @IsString()
  childAge?: string;

  @IsOptional()
  @IsArray()
  income?: string[];

  @IsOptional()
  @IsArray()
  attorneyPlan?: string[];

  @IsOptional()
  @IsString()
  caseSummary?: string;

  @IsOptional()
  @IsBoolean()
  enableConflictChecks?: boolean;

  @IsOptional()
  @IsBoolean()
  termsAndConditionsAccepted?: boolean;
  
  id: any;
}
