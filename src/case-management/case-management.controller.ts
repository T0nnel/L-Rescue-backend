/* eslint-disable prettier/prettier */
import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { CaseManagementService, FilterOptions } from './case-management.service';
import { CaseStatus } from 'src/casesubmission/dto/createcase.dto';

@Controller('case-management')

export class CaseManagementController {
    constructor(private readonly caseManagementService: CaseManagementService) {}

    @Get('available-cases/:attorneyId')
    async getAvailableCases(
        @Param('attorneyId') attorneyId: string,
        @Query() filters: FilterOptions
    ) {
        return this.caseManagementService.getAvailableCases(attorneyId, filters);
    }

    @Get('interested-cases/:attorneyId')
    async getInterestedCases(
        @Param('attorneyId') attorneyId: string,
        @Query() filters: FilterOptions
    ) {
        return this.caseManagementService.getInterestedCases(attorneyId, filters);
    }

    @Post('express-interest/:attorneyId/:caseId')
    async expressInterest(
        @Param('attorneyId') attorneyId: string,
        @Param('caseId') caseId: string,
    ) {
        return this.caseManagementService.expressInterest(attorneyId, caseId);
    }

    @Put('update-status/:attorneyId/:caseId')
    async updateCaseStatus(
        @Param('attorneyId') attorneyId: string,
        @Param('caseId') caseId: string,
        @Body('status') status: CaseStatus,
    ) {
        return this.caseManagementService.updateCaseStatus(attorneyId, caseId, status);
    }

    @Post('conflict-check/:attorneyId/:caseId')
    async submitConflictCheck(
        @Param('attorneyId') attorneyId: string,
        @Param('caseId') caseId: string,
        @Body() certificationData: any
    ) {
        return this.caseManagementService.submitConflictCheck(attorneyId, caseId, certificationData);
    }

    @Get('case-details/:attorneyId/:caseId')
    async getCaseDetails(
        @Param('attorneyId') attorneyId: string,
        @Param('caseId') caseId: string,
    ) {
        return this.caseManagementService.getCaseDetails(attorneyId, caseId);
    }
}
