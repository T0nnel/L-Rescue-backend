/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MailerController } from './mailer.controller';
import { MailerService } from './mailer.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [MailerController],
  providers: [MailerService],
})
export class MailerModule {}