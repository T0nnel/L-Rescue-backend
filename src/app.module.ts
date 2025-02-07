/* eslint-disable prettier/prettier */
// app.module.ts
import { Module } from '@nestjs/common';
import { WaitlistModule } from './waitlist/waitlist.module'; 
import { MailerModule } from './mailer/mailer.module';
import { RecaptchaModule } from './recaptcha/recaptcha.module';
import { CaseManagementController } from './case-management/case-management.controller';
import { CaseManagementModule } from './case-management/case-management.module';

@Module({
  imports: [WaitlistModule, MailerModule, RecaptchaModule, CaseManagementModule],
  controllers: [CaseManagementController], 
})
export class AppModule {}
