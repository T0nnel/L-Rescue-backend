/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { CaseManagementService } from './case-management.service';
import { CaseManagementController } from './case-management.controller';

@Module({
  controllers: [CaseManagementController],
  providers: [CaseManagementService]
})
export class CaseManagementModule {}
