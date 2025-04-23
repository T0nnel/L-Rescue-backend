/* eslint-disable prettier/prettier */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { CronJob } from 'cron';

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;
  private pendingFollowUps = new Map<string, { job: CronJob; jobName: string }>();
  private readonly defaultFrom = 'LegalRescue <noreply@legalrescue.ai>';

  constructor(private schedulerRegistry: SchedulerRegistry) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter(): Promise<void> {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT || '587', 10),
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
      pool: true, // Use connection pooling
      maxConnections: 5,
      connectionTimeout: 10000, // 10 seconds
    });

    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection established successfully');
    } catch (error) {
      this.logger.error('Failed to verify SMTP connection', error.stack);
      throw new Error('SMTP connection failed');
    }
  }

  async sendWaitlistFollowUp(to: string): Promise<void> {
    const subject = 'Please complete questions for our waitlist';
    const htmlContent = this.generateWaitlistFollowUpContent();

    this.cancelPendingFollowUp(to);

    const jobName = `followup-${to}-${Date.now()}`;
    const job = new CronJob(
      new Date(Date.now() + 15 * 60 * 1000),
      async () => {
        try {
          await this.sendEmail({
            to,
            subject,
            html: htmlContent,
          });
          this.pendingFollowUps.delete(to);
        } catch (error) {
          this.logger.error(`Failed to send follow-up to ${to}`, {
            error: error.message,
            stack: error.stack,
          });
        }
      },
      null,
      true,
      'UTC'
    );

    this.pendingFollowUps.set(to, { job, jobName });
    this.schedulerRegistry.addCronJob(jobName, job);
    this.logger.log(`Scheduled follow-up for ${to} in 15 minutes`);
  }

  cancelPendingFollowUp(to: string): void {
    const pending = this.pendingFollowUps.get(to);
    if (pending) {
      try {
        pending.job.stop();
        this.schedulerRegistry.deleteCronJob(pending.jobName);
        this.pendingFollowUps.delete(to);
        this.logger.log(`Cancelled follow-up for ${to}`);
      } catch (error) {
        this.logger.error(`Failed to cancel follow-up for ${to}`, error);
      }
    }
  }

  async userCompletedQuestionnaire(to: string): Promise<void> {
    this.cancelPendingFollowUp(to);
    this.logger.log(`Follow-up cancelled for ${to} (questionnaire completed)`);
  }

  async securedEmail(to: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Waitlist Discount Secured!',
      html: this.generateSecuredEmailContent(),
    });
  }

  private async sendEmail(mailOptions: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    try {
      const fullOptions = {
        from: this.defaultFrom,
        ...mailOptions,
      };

      const info = await this.transporter.sendMail(fullOptions);
      this.logger.log(`Email sent to ${mailOptions.to}`, {
        messageId: info.messageId,
      });
    } catch (error) {
      this.logger.error(`Email failed to ${mailOptions.to}`, {
        error: error.message,
        stack: error.stack,
        smtpConfig: {
          host: process.env.MAIL_HOST,
          port: process.env.MAIL_PORT,
        },
      });
      throw error;
    }
  }

  private generateWaitlistFollowUpContent(): string {
    return `
      <p>To secure your discount offer, please answer the remaining questions on the waitlist.<br/>
      You will receive an email when LegalRescue.ai officially launches
      </p>
    `;
  }

  private generateSecuredEmailContent(): string {
    return `
      <p>Thank you for completing the waitlist form. Your discount offer has been secured for your bar license(s).</p>
    `;
  }
}