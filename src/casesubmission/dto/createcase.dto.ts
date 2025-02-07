/* eslint-disable prettier/prettier */
import { IsArray, IsBoolean, IsDate, IsEnum, IsOptional, IsString } from 'class-validator';

export enum ConflictCheckStatus {
  NOT_STARTED = 'Not Started',
  PENDING_ATTORNEY_CERTIFICATION = 'Pending Attorney Certification',
  PENDING_CLIENT_APPROVAL = 'Pending Client Approval',
  COMPLETED = 'Completed',
  REJECTED = 'Rejected'
}



export enum CaseStatus {
  INTEREST_EXPRESSED = 'Interest Expressed',
  AWAITING_CLIENT_CONFLICT_CHECK = 'Awaiting Client Enhanced Conflict Check Approval',
  AWAITING_ATTORNEY_CONFLICT_CHECK = 'Awaiting Your Conflict Check Certification',
  CONFLICT_CHECK_COMPLETED = 'Interest Expressed & Conflict Check Completed',
  TERMS_SENT = 'Range of Terms or Contract sent',
  RETAINED = 'Retained Client',
  NO_LONGER_INTERESTED = 'No Longer Interested'
}

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

  // New fields for attorney case management
  @IsOptional()
  aiGeneratedSummary: {
    title: string,
    summary: string
  };



  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;


  @IsOptional()
  @IsArray()
  questionnaireResponses?: {
    question: string;
    answer: string;
  }[];

  @IsOptional()
  @IsString()
  clientCaseSummary?: string;



  @IsOptional()
  @IsBoolean()
  conflictCheckCompleted?: boolean;

  @IsEnum(ConflictCheckStatus)
  @IsOptional()
  conflictCheckStatus?: ConflictCheckStatus;

  @IsDate()
  @IsOptional()
  attorneyConflictCheckDate?: Date;

  @IsString()
  @IsOptional()
  attorneyConflictCheckCertification?: string;

  @IsBoolean()
  @IsOptional()
  clientConflictCheckApproval?: boolean;

  @IsDate()
  @IsOptional()
  clientConflictCheckApprovalDate?: Date;

  @IsString()
  @IsOptional()
  conflictCheckNotes?: string;

 
  @IsDate()
  @IsOptional()
  interestExpressedDate?: Date;

  @IsDate()
  @IsOptional()
  conflictCheckCompletedDate?: Date;


  id: any;
}