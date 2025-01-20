/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly resendClient: Resend;

  constructor(private configService: ConfigService) {
    this.resendClient = new Resend(this.configService.get('RESEND_API_KEY'));
  }

  async sendEmail(to: string): Promise<any> {
    const subject = 'Please complete questions for our waitlist';
    const htmlContent = `
      <p>To secure your discount offer, please answer the remaining questions on the waitlist.<br/>
      You will receive an email when LegalRescue.ai officially launches
      </p>
    `;

    return this.send(to, subject, htmlContent);
  }

  async securedEmail(to: string): Promise<any> {
    const subject = 'Waitlist Discount Secured!';
    const htmlContent = `
      <p>Thank you for completing the waitlist form. Your discount offer has been secured for your bar license(s).</p>`;

    return this.send(to, subject, htmlContent);
  }

  private async send(to: string, subject: string, htmlContent: string): Promise<any> {
    try {
      const response = await this.resendClient.emails.send({
        from: 'LegalRescue <noreply@legalrescue.ai>',
        to,
        subject,
        html: htmlContent,
      });

      const responseId = (response as any)?.id || 'Unknown ID';
      this.logger.log(`Email sent successfully: ${responseId}`);

      return response;
    } catch (error) {
      this.logger.error('Error sending email:', error.message || error);
      throw error;
    }
  }
}
