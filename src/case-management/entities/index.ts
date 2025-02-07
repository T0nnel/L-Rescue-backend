/* eslint-disable prettier/prettier */

import { CaseStatus } from "src/casesubmission/dto/createcase.dto";
export interface CaseInterest {
    id: string;
    case_id: string;
    attorney_id: string;
    status: CaseStatus;
    interest_expressed_at: string;
    conflict_check_certification?: any;
    conflict_check_completed_at?: string;
    updated_at?: string;
  }