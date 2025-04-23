/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MailerController } from './mailer.controller';
import { MailerService } from './mailer.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email', // This must match the queue name used in @InjectQueue()
      // Optional: Add Redis configuration if not using defaults
      // redis: {
      //   host: 'localhost',
      //   port: 6379,
      // }
    }),
  ],
  controllers: [MailerController],
  providers: [MailerService],
})
export class MailerModule {}