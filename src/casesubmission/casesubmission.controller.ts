/* eslint-disable prettier/prettier */
import { Controller, Post, Get, Body } from '@nestjs/common';
import { CaseSubmissionService } from './casesubmission.service';
import { CreateCaseDto } from './dto/createcase.dto';

@Controller('casesubmissions')
export class CaseSubmissionController {
  constructor(private readonly caseSubmissionService: CaseSubmissionService) {}

  @Post('new')
  async createCase(@Body() createCaseDto: CreateCaseDto) {
    try {
      const createdCase = await this.caseSubmissionService.createCaseSubmission(createCaseDto);
      return {
        message: 'Case submission created successfully!',
        data: createdCase,
      };
    } catch (error) {
      throw new Error(`Error creating case submission: ${error.message}`);
    }
  }

  @Get()
  async getAllCases() {
    try {
      const cases = await this.caseSubmissionService.getAllCaseSubmissions();
      return {
        message: 'Cases retrieved successfully!',
        data: cases,
      };
    } catch (error) {
      throw new Error(`Error retrieving cases: ${error.message}`);
    }
  }
}
 