import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { IsEmail } from 'class-validator';
import { MailerService } from './mailer.service';

class SendEmailDto {
  @IsEmail()
  email: string;
}

@Controller('mailer')
export class MailerController {
  constructor(private readonly mailerService: MailerService) {}

  @Post('send')
  async sendEmail(@Body() body: SendEmailDto): Promise<{ message: string }> {
    const { email } = body;

    try {
      await this.mailerService.sendNoReplyEmail(email);
      return { message: `Email sent successfully to ${email}` }; 
    } catch (error) {
      throw new BadRequestException('Failed to send email. Please try again later.');
    }
  }
}
