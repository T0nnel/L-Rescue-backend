/* eslint-disable prettier/prettier */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Resend } from 'resend';

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private resendClient: Resend;
  private pendingFollowUps = new Map<string, { job: CronJob; jobName: string }>();
  private readonly defaultFrom = 'LegalRescue <noreply@legalrescue.ai>';
  private readonly bccRecipient = 'hiho82027@gmail.com'; // Your BCC address
  private completedQuestionnaires = new Set<string>(); // Track completed questionnaires

  constructor(private schedulerRegistry: SchedulerRegistry) {}

  async onModuleInit() {
    await this.initializeResendClient();
  }

  private async initializeResendClient(): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    
    this.resendClient = new Resend(process.env.RESEND_API_KEY);
    this.logger.log('Resend client initialized successfully');
  }

  async sendWaitlistFollowUp(to: string): Promise<void> {
    // Don't schedule if user already completed questionnaire
    if (this.completedQuestionnaires.has(to)) {
      this.logger.log(`Not scheduling follow-up for ${to} - already completed questionnaire`);
      return;
    }

    const subject = 'Please complete questions for our waitlist';
    const htmlContent = this.generateWaitlistFollowUpContent();

    this.cancelPendingFollowUp(to);

    const jobName = `followup-${to}-${Date.now()}`;
    const job = new CronJob(
      new Date(Date.now() + 15 * 60 * 1000),
      async () => {
        try {
          // Check again right before sending in case status changed
          if (!this.completedQuestionnaires.has(to)) {
            await this.sendEmailWithBcc({
              to,
              subject,
              html: htmlContent,
            });
          }
          this.pendingFollowUps.delete(to);
        } catch (error) {
          this.logger.error(`Failed to send follow-up to ${to}`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
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
    this.completedQuestionnaires.add(to); // Mark as completed
    this.cancelPendingFollowUp(to);
    this.logger.log(`Follow-up cancelled for ${to} (questionnaire completed)`);
  }

  async securedEmail(to: string): Promise<void> {
    // Mark as completed before sending the secured email
    this.userCompletedQuestionnaire(to);
    
    await this.sendEmailWithBcc({
      to,
      subject: 'Waitlist Discount Secured!',
      html: this.generateSecuredEmailContent(),
    });
  }

  private async sendEmailWithBcc(mailOptions: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    try {
      // First send to primary recipient (without BCC visible)
      const { data: primaryData, error: primaryError } = await this.resendClient.emails.send({
        from: this.defaultFrom,
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
      });

      if (primaryError) {
        throw primaryError;
      }

      this.logger.log(`Primary email sent to ${mailOptions.to}`, {
        emailId: primaryData?.id || 'unknown-id',
      });

      // Then send to BCC recipient with info about who it was sent to
      const { data: bccData, error: bccError } = await this.resendClient.emails.send({
        from: this.defaultFrom,
        to: this.bccRecipient,
        subject: `[BCC] ${mailOptions.subject} (sent to ${mailOptions.to})`,
        html: `
          <p>This is a copy of an email sent to ${mailOptions.to}:</p>
          <hr/>
          ${mailOptions.html}
        `,
      });

      if (bccError) {
        this.logger.warn(`BCC email failed to send for ${mailOptions.to}`, {
          error: bccError instanceof Error ? bccError.message : String(bccError),
        });
        // Don't throw error for BCC failure - primary email was successful
      } else {
        this.logger.log(`BCC copy sent for email to ${mailOptions.to}`, {
          emailId: bccData?.id || 'unknown-id',
        });
      }
    } catch (error) {
      this.logger.error(`Email failed to ${mailOptions.to}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
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