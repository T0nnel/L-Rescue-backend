/* eslint-disable prettier/prettier */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateCaseDto } from './dto/createcase.dto';
import { SupabaseService } from './supabase.service';

@Injectable()
export class CaseSubmissionService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async createCaseSubmission(createCaseDto: CreateCaseDto) {
    try {
      return await this.supabaseService.createSubmission(createCaseDto);
    } catch (error) {
      throw new InternalServerErrorException(`Error in CaseSubmissionService: ${error.message}`);
    }
  }

  async getAllCaseSubmissions() {
    try {
      return await this.supabaseService.getAllSubmissions();
    } catch (error) {
      throw new InternalServerErrorException(`Error in CaseSubmissionService: ${error.message}`);
    }
  }
}
