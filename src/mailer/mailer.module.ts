/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MailerController } from './mailer.controller';
import { MailerService } from './mailer.service';
import { SupabaseService } from 'src/supabase/supabase.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [MailerController],
  providers: [MailerService,SupabaseService],
})
export class MailerModule {}