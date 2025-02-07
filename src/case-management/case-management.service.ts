/* eslint-disable prettier/prettier */

 export  interface FilterOptions {
    timeFrame?: string;
    practiceArea?: string;
    county?: string;
    zipCode?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }
  

  import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
  import { SupabaseClient } from '@supabase/supabase-js';
import { CaseStatus } from 'src/casesubmission/dto/createcase.dto';
  import { SupabaseService } from 'src/supabase/supabase.service';
import { CaseInterest } from './entities';

  @Injectable()
  export class CaseManagementService {
    private supabaseClient: SupabaseClient;
     
    constructor(private readonly supabaseService: SupabaseService) {
      this.supabaseClient = supabaseService.getClient();
    }
  
    async getAvailableCases(attorneyId: string, filters: FilterOptions) {
      const { data: attorneyData, error: attorneyError } = await this.supabaseClient
        .from('attorneys')
        .select('countiesSubscribed, zipCodesSubscribed, areasOfPractice')
        .eq('attorney_id', attorneyId)
        .single();
  
      if (attorneyError || !attorneyData) {
        throw new NotFoundException('Attorney not found');
      }
  
      const { data: retainedCases } = await this.supabaseClient
        .from('case_interests')
        .select('case_id')
        .eq('status', CaseStatus.RETAINED);
  
      // Get this attorney's interested cases to exclude
      const { data: interestedCases } = await this.supabaseClient
        .from('case_interests')
        .select('case_id')
        .eq('attorney_id', attorneyId);
  
      const casesToExclude = [
        ...(retainedCases?.map(c => c.case_id) || []),
        ...(interestedCases?.map(i => i.case_id) || [])
      ];
  
      let query = this.supabaseClient
        .from('cases')
        .select(`
          id,
          created_at,
          legalCategory,
          aiGeneratedHeading,
          aiGeneratedSummary,
          county,
          zip_code,
          enableConflictChecks,
          clients!inner (
            id,
            zip_code
          )
        `);
  
      if (casesToExclude.length > 0) {
        query = query.not('id', 'in', casesToExclude);
      }
  
      query = this.applyLocationFilters(query, attorneyData, filters);
      query = this.applyTimeFrameFilter(query, filters.timeFrame);
      
      if (filters.practiceArea) {
        query = query.eq('legalCategory', filters.practiceArea);
      }
  
      if (filters.sortBy) {
        query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' });
      } else {
        query = query.order('created_at', { ascending: false });
      }
  
      const { data: cases, error } = await query;
      if (error) throw new Error(`Error fetching cases: ${error.message}`);
      
      return cases;
    }
  
    async getInterestedCases(attorneyId: string, filters: FilterOptions) {
      const { data: retainedCases } = await this.supabaseClient
        .from('case_interests')
        .select('case_id, attorney_id')
        .eq('status', CaseStatus.RETAINED);
  
      const retainedCaseMap = new Map(
        retainedCases?.map(c => [c.case_id, c.attorney_id]) || []
      );
  
      let query = this.supabaseClient
        .from('case_interests')
        .select(`
          *,
          cases (
            id,
            created_at,
            legalCategory,
            aiGeneratedHeading,
            aiGeneratedSummary,
            county,
            zip,
            enableConflictChecks,
            questionnaireResponses,
            clientCaseSummary,

            clients (
              id,
              first_name,
              last_name,
              zip_code
            )
          )
        `)
        .eq('attorney_id', attorneyId);
  
      if (filters.sortBy) {
        query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' });
      }
  
      const { data, error } = await query;
      if (error) throw new Error(`Error fetching interested cases: ${error.message}`);
  
      // Filter out cases retained by other attorneys
      return data?.filter(interest => {
        const retainingAttorney = retainedCaseMap.get(interest.case_id);
        if (!retainingAttorney) return true;
        return retainingAttorney === attorneyId;
      }).map(interest => {
        const canViewClientDetails = 
          interest.status === CaseStatus.CONFLICT_CHECK_COMPLETED &&
          interest.conflict_check_completed_at &&
          interest.conflict_check_certification;
  
        if (!canViewClientDetails) {
          delete interest.cases.clients.first_name;
          delete interest.cases.clients.last_name;
          delete interest.cases.questionnaireResponses;
          delete interest.cases.clientCaseSummary;
          delete interest.cases.clients.zip_code;

        }
  
        return interest;
      });
    }
  
    async expressInterest(attorneyId: string, caseId: string): Promise<CaseInterest> {
      const { data: retainedInterest } = await this.supabaseClient
        .from('case_interests')
        .select('attorney_id')
        .match({ case_id: caseId, status: CaseStatus.RETAINED })
        .single();
  
      if (retainedInterest) {
        throw new ForbiddenException('Case has already been retained');
      }
  
      const { data: existingInterest } = await this.supabaseClient
        .from('case_interests')
        .select()
        .match({ attorney_id: attorneyId, case_id: caseId })
        .single();
  
      if (existingInterest) {
        throw new ForbiddenException('Interest already expressed');
      }
  
      // Get case details
      const { data: caseData } = await this.supabaseClient
        .from('cases')
        .select('enableConflictChecks')
        .eq('id', caseId)
        .single();
  
      if (!caseData) {
        throw new NotFoundException('Case not found');
      }
  
      const initialStatus = caseData.enableConflictChecks 
        ? CaseStatus.AWAITING_CLIENT_CONFLICT_CHECK
        : CaseStatus.AWAITING_ATTORNEY_CONFLICT_CHECK;
  
      const { data, error } = await this.supabaseClient
        .from('case_interests')
        .insert({
          attorney_id: attorneyId,
          case_id: caseId,
          status: initialStatus,
          interest_expressed_at: new Date().toISOString()
        })
        .select()
        .single();
  
      if (error) throw new Error(`Error expressing interest: ${error.message}`);
      return data;
    }
  
    async submitConflictCheck(attorneyId: string, caseId: string, certificationData: any) {
      const { data: interest } = await this.supabaseClient
        .from('case_interests')
        .select('status, cases!inner(enableConflictChecks, id)')
        .match({ attorney_id: attorneyId, case_id: caseId })
        .single();
  
      if (!interest) {
        throw new NotFoundException('Case interest not found');
      }
  
      // Check if case is retained by another attorney
      const { data: retainedInterest } = await this.supabaseClient
        .from('case_interests')
        .select('attorney_id')
        .match({ case_id: caseId, status: CaseStatus.RETAINED })
        .single();
  
      if (retainedInterest && retainedInterest.attorney_id !== attorneyId) {
        throw new ForbiddenException('Case has been retained by another attorney');
      }
  
      const newStatus = interest.cases[0].enableConflictChecks
        ? CaseStatus.AWAITING_CLIENT_CONFLICT_CHECK
        : CaseStatus.CONFLICT_CHECK_COMPLETED;
  
      const { data, error } = await this.supabaseClient
        .from('case_interests')
        .update({
          status: newStatus,
          conflict_check_certification: certificationData,
          conflict_check_completed_at: new Date().toISOString()
        })
        .match({ attorney_id: attorneyId, case_id: caseId })
        .select()
        .single();
  
      if (error) throw new Error(`Error submitting conflict check: ${error.message}`);
      return data;
    }
  
    async updateCaseStatus(attorneyId: string, caseId: string, newStatus: CaseStatus) {
      const { data: currentInterest } = await this.supabaseClient
        .from('case_interests')
        .select('status')
        .match({ attorney_id: attorneyId, case_id: caseId })
        .single();
  
      if (!currentInterest) {
        throw new NotFoundException('Case interest not found');
      }
  
      if (!this.isValidStatusTransition(currentInterest.status, newStatus)) {
        throw new ForbiddenException('Invalid status transition');
      }
  
      // Additional check for RETAINED status
      if (newStatus === CaseStatus.RETAINED) {
        const { data: existingRetained } = await this.supabaseClient
          .from('case_interests')
          .select('attorney_id')
          .match({ case_id: caseId, status: CaseStatus.RETAINED })
          .single();
  
        if (existingRetained) {
          throw new ForbiddenException('Case has already been retained');
        }
  
        // Verify conflict check is completed
        if (currentInterest.status !== CaseStatus.CONFLICT_CHECK_COMPLETED &&
            currentInterest.status !== CaseStatus.TERMS_SENT) {
          throw new ForbiddenException('Cannot retain case before completing conflict check');
        }
      }
  
      const { data, error } = await this.supabaseClient
        .from('case_interests')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .match({ attorney_id: attorneyId, case_id: caseId })
        .select()
        .single();
  
      if (error) throw new Error(`Error updating case status: ${error.message}`);
      return data;
    }
  
    async getCaseDetails(attorneyId: string, caseId: string) {
      // Check if case is retained by another attorney
      const { data: retainedInterest } = await this.supabaseClient
        .from('case_interests')
        .select('attorney_id')
        .match({ case_id: caseId, status: CaseStatus.RETAINED })
        .single();
  
      if (retainedInterest && retainedInterest.attorney_id !== attorneyId) {
        throw new ForbiddenException('Case has been retained by another attorney');
      }
  
      // Get attorney's interest details
      const { data: interest } = await this.supabaseClient
        .from('case_interests')
        .select(`
          status,
          conflict_check_completed_at,
          conflict_check_certification
        `)
        .match({ attorney_id: attorneyId, case_id: caseId })
        .single();
  
      if (!interest) {
        throw new ForbiddenException('Not authorized to view case details');
      }
  
      const { data: caseData } = await this.supabaseClient
        .from('cases')
        .select(`
          *,
          clients (*)
        `)
        .eq('id', caseId)
        .single();
  
      if (!caseData) {
        throw new NotFoundException('Case not found');
      }
  
      const canViewClientDetails = 
        interest.status === CaseStatus.CONFLICT_CHECK_COMPLETED &&
        interest.conflict_check_completed_at &&
        interest.conflict_check_certification;
  
      if (!canViewClientDetails) {
        const safeClientData = {
          id: caseData.clients.id,
          zip_code: caseData.clients.zip_code
        };
        caseData.clients = safeClientData;
      }
  
      return {
        ...caseData,
        status: interest.status,
        canViewClientDetails
      };
    }
  
    private isValidStatusTransition(currentStatus: CaseStatus, newStatus: CaseStatus): boolean {
      const validTransitions = {
        [CaseStatus.INTEREST_EXPRESSED]: [
          CaseStatus.AWAITING_ATTORNEY_CONFLICT_CHECK,
          CaseStatus.NO_LONGER_INTERESTED
        ],
        [CaseStatus.AWAITING_CLIENT_CONFLICT_CHECK]: [
          CaseStatus.AWAITING_ATTORNEY_CONFLICT_CHECK,
          CaseStatus.NO_LONGER_INTERESTED
        ],
        [CaseStatus.AWAITING_ATTORNEY_CONFLICT_CHECK]: [
          CaseStatus.CONFLICT_CHECK_COMPLETED,
          CaseStatus.NO_LONGER_INTERESTED
        ],
        [CaseStatus.CONFLICT_CHECK_COMPLETED]: [
          CaseStatus.TERMS_SENT,
          CaseStatus.RETAINED,
          CaseStatus.NO_LONGER_INTERESTED
        ],
        [CaseStatus.TERMS_SENT]: [
          CaseStatus.RETAINED,
          CaseStatus.NO_LONGER_INTERESTED
        ]
      };
  
      return validTransitions[currentStatus]?.includes(newStatus) || false;
    }
  
    private applyLocationFilters(query: any, attorneyData: any, filters: FilterOptions) {
      const countiesSubscribed = attorneyData.countiesSubscribed.map(
        (county: { name: string }) => county.name
      );
  
      if (filters?.zipCode && this.isLargePopulation(filters.county)) {
        return query.eq('zip_code', filters.zipCode);
      }
  
      if (filters?.county && countiesSubscribed.includes(filters.county)) {
        return query.eq('county', filters.county);
      }
  
      return query.in('county', countiesSubscribed);
    }
  
    private applyTimeFrameFilter(query: any, timeFrame?: string) {
      if (!timeFrame) return query;
  
      const now = new Date();
      let startDate = new Date();
  
      switch (timeFrame) {
        case '24h':
          startDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '3m':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case '6m':
          startDate.setMonth(now.getMonth() - 6);
          break;
        case 'ytd':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          return query;
      }
  
      return query.gte('created_at', startDate.toISOString());
    }
  
    private isLargePopulation(county: string): boolean {
    const largePopulationCounties = ['Los Angeles', 'Cook', 'Harris'];
    return largePopulationCounties.includes(county);
  }
}