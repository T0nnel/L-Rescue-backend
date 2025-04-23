/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { CronJob } from 'cron';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private schedulerRegistry: SchedulerRegistry
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT || '587', 10),
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });
  }

  async sendWaitlistFollowUp(to: string): Promise<void> {
    const subject = 'Please complete questions for our waitlist';
    const htmlContent = `
      <p>To secure your discount offer, please answer the remaining questions on the waitlist.<br/>
      You will receive an email when LegalRescue.ai officially launches
      </p>
    `;

    // Schedule email to be sent in 15 minutes
    const delay = 15 * 60 * 1000; // 15 minutes in milliseconds
    const job = new CronJob(new Date(Date.now() + delay), async () => {
      try {
        await this.sendEmail(to, subject, htmlContent);
      } catch (error) {
        this.logger.error(`Failed to send follow-up email to ${to}:`, error);
      }
    });

    this.schedulerRegistry.addCronJob(`followup-${to}-${Date.now()}`, job);
    job.start();
  }

  async securedEmail(to: string): Promise<void> {
    const subject = 'Waitlist Discount Secured!';
    const htmlContent = `
      <p>Thank you for completing the waitlist form. Your discount offer has been secured for your bar license(s).</p>`;

    await this.sendEmail(to, subject, htmlContent);
  }

  private async sendEmail(to: string, subject: string, htmlContent: string): Promise<void> {
    try {
      const mailOptions = {
        from: 'LegalRescue <noreply@legalrescue.ai>',
        to,
        subject,
        html: htmlContent,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }
}