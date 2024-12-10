/* eslint-disable prettier/prettier */
// app.module.ts
import { Module } from '@nestjs/common';
import { WaitlistModule } from './waitlist/waitlist.module'; // Import Waitlist module
import { MailerModule } from './mailer/mailer.module';

@Module({
  imports: [WaitlistModule, MailerModule], // Include WaitlistModule
})
export class AppModule {}
