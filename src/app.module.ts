/* eslint-disable prettier/prettier */
// app.module.ts
import { Module } from '@nestjs/common';
import { WaitlistModule } from './waitlist/waitlist.module'; 
import { MailerModule } from './mailer/mailer.module';
import { RecaptchaModule } from './recaptcha/recaptcha.module';

@Module({
  imports: [WaitlistModule, MailerModule, RecaptchaModule], 
})
export class AppModule {}
