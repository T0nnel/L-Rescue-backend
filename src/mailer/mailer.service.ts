/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { CronJob } from 'cron';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;
  private pendingFollowUps = new Map<string, { job: CronJob, jobName: string }>();
  
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

    // Cancel any existing follow-up for this user
    this.cancelPendingFollowUp(to);

    // Schedule new follow-up email in 15 minutes
    const jobName = `followup-${to}-${Date.now()}`;
    const job = new CronJob(
      new Date(Date.now() + 15 * 60 * 1000), // Run in 15 minutes
      async () => {
        try {
          await this.sendEmail(to, subject, htmlContent);
          this.pendingFollowUps.delete(to);
        } catch (error) {
          this.logger.error(`Failed to send follow-up email to ${to}:`, error);
        }
      },
      null, // onComplete
      true, // start
      'UTC' // timeZone
    );

    // Store both the job and its name
    this.pendingFollowUps.set(to, { job, jobName });
    this.schedulerRegistry.addCronJob(jobName, job);
    this.logger.log(`Scheduled follow-up email for ${to} in 15 minutes`);
  }

  cancelPendingFollowUp(to: string): void {
    const pending = this.pendingFollowUps.get(to);
    if (pending) {
      pending.job.stop();
      this.schedulerRegistry.deleteCronJob(pending.jobName);
      this.pendingFollowUps.delete(to);
      this.logger.log(`Cancelled pending follow-up for ${to}`);
    }
  }

  async userCompletedQuestionnaire(to: string): Promise<void> {
    this.cancelPendingFollowUp(to);
    this.logger.log(`User ${to} completed questionnaire - follow-up cancelled`);
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