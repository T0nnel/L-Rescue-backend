/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

interface BarLicense {
  state: string;
  licenseNumber: string;
}

interface UserDetails {
  firstName: string;
  lastName: string;
  email: string | null;
  legalPractices: string[];
  phone?: string;
  firmName?: string;
  firmZipCode?: string;
  membershipType?: string;
  barLicenses?: BarLicense[];
}


interface SupabaseUser {
  first_name: string;
  last_name: string;
  email: string | null; // Explicitly mark as possibly null
  legal_practices?: string[] | null;
  phone?: string | null;
  firm_name?: string | null;
  firm_zip_code?: string | null;
  membership_type?: string | null;
  bar_licenses?: BarLicense[] | null;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface PendingFollowUp {
  job: CronJob;
  jobName: string;
}

interface MailerConfig {
  defaultFrom: string;
  bccRecipient: string;
  supportEmail: string;
  logoUrl: string;
  waitlistUrl: string;
  emailLogoPath: string;
  followUpDelayMinutes: number;
  supabaseUrl: string;
  supabaseKey: string;
}

@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private resendClient: Resend;
  private supabaseClient: ReturnType<typeof createClient>;
  private pendingFollowUps = new Map<string, PendingFollowUp>();
  private completedQuestionnaires = new Set<string>();
  
  private readonly config: MailerConfig = {
    defaultFrom: 'LegalRescue <noreply@legalrescue.ai>',
    bccRecipient: 'totimbugz@gmail.com',
    supportEmail: 'attorneysupport@legalrescue.ai',
    logoUrl: 'https://legalrescue.ai/images/email-logo.png',
    waitlistUrl: 'https://legalrescue.ai/waitlist',
    emailLogoPath: 'https://t0nnel.github.io/L-Rescue-backend/legalrescue-logo.png',
    followUpDelayMinutes: 15,
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_KEY || ''
  };

  constructor(private schedulerRegistry: SchedulerRegistry) {}

  async onModuleInit(): Promise<void> {
    await this.initializeResendClient();
    await this.initializeSupabaseClient();
  }

  private async initializeResendClient(): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    
    this.resendClient = new Resend(process.env.RESEND_API_KEY);
    this.logger.log('Resend client initialized successfully');
  }

  private async initializeSupabaseClient(): Promise<void> {
    if (!this.config.supabaseUrl || !this.config.supabaseKey) {
      throw new Error('Supabase URL and Key must be configured');
    }
    
    this.supabaseClient = createClient(
      this.config.supabaseUrl,
      this.config.supabaseKey
    );
    this.logger.log('Supabase client initialized successfully');
  }


private async getUserData(email: string): Promise<Partial<UserDetails>> {
  try {
    const { data, error } = await this.supabaseClient
      .from('waitlist')
      .select('*')
      .eq('email', email)
      .single();
  
    if (error) {
      this.logger.error('Error fetching user data from Supabase', { error });
      throw error;
    }

    if (!data) {
      this.logger.warn(`No user found with email: ${email}`);
      return {};
    }

    // Map the Supabase data structure to your expected interface
    return {
      firstName: typeof data.firstName === 'string' ? data.firstName : '',
      lastName: typeof data.lastName === 'string' ? data.lastName : '',
      email: typeof data.email === 'string' ? data.email : email, // Fallback to input email
      legalPractices: Array.isArray(data.legalPractices) ? data.legalPractices : [],
      phone: data.phone ? String(data.phone) : undefined, // Convert number to string
      firmName: typeof data.firmName === 'string' ? data.firmName : undefined,
      firmZipCode: typeof data.firmAddress === 'string' ? data.firmAddress : undefined,
      membershipType: typeof data.selectedMembership === 'string' ? data.selectedMembership : undefined,
      barLicenses: data.licenses ? Object.entries(data.licenses).map(([state, licenseNumber]) => ({
        state,
        licenseNumber: String(licenseNumber)
      })) : []
    };
  } catch (error) {
    this.logger.error('Failed to fetch user data from Supabase', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  } 
}

private prepareUserDetails(to: string, userDetails?: Partial<UserDetails>): UserDetails {
  const safeUserDetails = userDetails || {};
  
  if (typeof to !== 'string') {
    this.logger.error('Invalid email parameter', { email: to });
    throw new Error('Email must be a string');
  }

  return {
    firstName: safeUserDetails.firstName || 'User',
    lastName: safeUserDetails.lastName || '',
    email: to,
    legalPractices: safeUserDetails.legalPractices || [],
    phone: safeUserDetails.phone || 'Not provided',
    firmName: safeUserDetails.firmName || 'Not provided',
    firmZipCode: safeUserDetails.firmZipCode || 'Not provided',
    membershipType: safeUserDetails.membershipType || 'Not specified',
    barLicenses: safeUserDetails.barLicenses || []
  };
}

  public async sendWaitlistFollowUp(to: string): Promise<void> {
    if (!to) {
      this.logger.warn('Attempted to send follow-up with empty email address');
      throw new Error('Email address is required');
    }

    if (this.completedQuestionnaires.has(to)) {
      this.logger.debug(`Skipping follow-up for ${to} - questionnaire completed`);
      return;
    }

    this.cancelPendingFollowUp(to);

    const subject = 'Please complete questions for our waitlist - LegalRescue.ai';
    const htmlContent = this.generateWaitlistFollowUpContent();

    const jobName = `followup-${to}-${Date.now()}`;
    const followUpTime = new Date(Date.now() + this.config.followUpDelayMinutes * 60 * 1000);

    const job = new CronJob(
      followUpTime,
      this.createFollowUpHandler(to, subject, htmlContent, jobName),
      null,
      true,
      'UTC'
    );

    this.pendingFollowUps.set(to, { job, jobName });
    this.schedulerRegistry.addCronJob(jobName, job);
    
    this.logger.log(`Scheduled follow-up for ${to} in ${this.config.followUpDelayMinutes} minutes`);
  }

  private createFollowUpHandler(
    to: string,
    subject: string,
    htmlContent: string,
    jobName: string
  ): () => Promise<void> {
    return async () => {
      try {
        if (!this.completedQuestionnaires.has(to)) {
          this.logger.debug(`Executing follow-up job for ${to}`);
          await this.sendEmail({
            to,
            subject,
            html: htmlContent
          });
          this.logger.log(`Follow-up email sent to ${to}`);
        } else {
          this.logger.debug(`Skipping follow-up for ${to} - questionnaire completed`);
        }
        this.pendingFollowUps.delete(to);
      } catch (error) {
        this.logger.error(`Failed to send follow-up to ${to}`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      } finally {
        this.schedulerRegistry.deleteCronJob(jobName);
      }
    };
  }

  public cancelPendingFollowUp(to: string): void {
    if (!to) return;

    const pending = this.pendingFollowUps.get(to);
    if (!pending) return;

    try {
      pending.job.stop();
      this.schedulerRegistry.deleteCronJob(pending.jobName);
      this.pendingFollowUps.delete(to);
      this.logger.log(`Cancelled follow-up for ${to}`);
    } catch (error) {
      this.logger.error(`Failed to cancel follow-up for ${to}`, error);
    }
  }

  public async markQuestionnaireComplete(to: string): Promise<void> {
    if (!to) {
      this.logger.warn('Attempted to mark questionnaire complete with empty email');
      return;
    }

    this.completedQuestionnaires.add(to);
    this.cancelPendingFollowUp(to);
    this.logger.log(`Marked questionnaire complete for ${to}`);
  }

  public async sendSecuredEmail(to: string, userDetails?: Partial<UserDetails>): Promise<void> {
    try {
      if (!to) {
        throw new Error('Email address is required');
      }

      this.logger.debug('Starting secured email process', { to });

      // Get user data from Supabase if not provided
      const supabaseUserData = userDetails ? {} : await this.getUserData(to);
      const combinedDetails = { ...supabaseUserData, ...userDetails };

      // Validate and prepare user details
      const completeDetails = this.prepareUserDetails(to, combinedDetails);
      this.logger.debug('Complete user details for email', { completeDetails });

      // Generate email content
      const emailContent = this.generateSecuredEmailContent(completeDetails);
      
      await this.markQuestionnaireComplete(to);
      await this.sendEmail({
        to,
        subject: 'Waitlist Discount Secured! - LegalRescue.ai',
        html: emailContent
      });

      this.logger.log(`Successfully sent secured email to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send secured email to ${to}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }


  private async sendEmail(mailOptions: EmailOptions): Promise<void> {
    try {
      this.logger.debug('Sending email', { 
        to: mailOptions.to, 
        subject: mailOptions.subject,
        htmlPreview: mailOptions.html.substring(0, 100) + '...'
      });

      const { data: primaryData, error: primaryError } = await this.resendClient.emails.send({
        from: this.config.defaultFrom,
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
      });

      if (primaryError) {
        this.logger.error('Primary email send failed', { error: primaryError });
        throw primaryError;
      }

      const { data: bccData, error: bccError } = await this.resendClient.emails.send({
        from: this.config.defaultFrom,
        to: this.config.bccRecipient,
        subject: `[BCC] ${mailOptions.subject} (sent to ${mailOptions.to})`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Email Copy</h2>
            <p><strong>Original recipient:</strong> ${mailOptions.to}</p>
            <p><strong>Subject:</strong> ${mailOptions.subject}</p>
            <hr style="margin: 20px 0; border: 1px solid #eee;"/>
            ${mailOptions.html}
          </div>
        `,
      });

      if (bccError) {
        this.logger.warn('BCC email send failed', { error: bccError });
      }

      this.logger.log(`Email successfully sent to ${mailOptions.to}`, {
        primaryEmailId: primaryData?.id,
        bccEmailId: bccData?.id,
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${mailOptions.to}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private generateWaitlistFollowUpContent(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <p>To secure your discount offer, please navigate back to 
          <a href="${this.config.waitlistUrl}" style="color: #0070CD; text-decoration: none;">
            ${this.config.waitlistUrl}
          </a> 
          to finish the remaining questions on the waitlist. Thank you!
        </p>
        
        <p style="margin-top: 20px;">Warm regards,</p>
        <p><strong>The LegalRescue.ai Team</strong></p>
        
        <div style="margin-top: 30px;">
          <a href="mailto:${this.config.supportEmail}" style="color: #0070CD; text-decoration: none;">
            📩 ${this.config.supportEmail}
          </a>
        </div>
        
         <div style="margin-top: 20px;">
           <img src="${this.config.emailLogoPath}" alt="LegalRescue.ai Logo" style="max-width: 300px;">
      </div>
      </div>
    `;
  }

  private generateSecuredEmailContent(userDetails: UserDetails): string {
    const formatPhone = (phone: string): string => {
      if (!phone || phone === 'Not provided') return phone;
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length === 10) {
        return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
      }
      return phone;
    };

    const licenseRows = userDetails.barLicenses?.length ? `
      ${userDetails.barLicenses.map(license => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee; width: 40%;">
            <strong>${license.state} Bar License #:</strong>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">
            ${license.licenseNumber || 'Not provided'}
          </td>
        </tr>
      `).join('')}
    ` : '';

    return `  
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #0070CD; margin-bottom: 20px;">Hi ${userDetails.firstName},</h2>
        
        <p style="font-size: 16px; line-height: 1.5;">
         Thanks for joining the waitlist for <strong>LegalRescue.ai</strong> – your discount offer has been secured for your bar license(s) (or equivalent) & we’re excited to have you on board!
        </p>
        
        <h3 style="color: #0070CD; margin-top: 24px; margin-bottom: 16px;">Here are the details we have on file:</h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee; width: 40%;"><strong>Full Name:</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${userDetails.firstName} ${userDetails.lastName}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${userDetails.email}</td>
          </tr>
          ${licenseRows}
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>Legal Practice(s):</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
              ${userDetails.legalPractices.join(', ') || 'Not specified'}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${formatPhone(userDetails.phone)}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>Firm:</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${userDetails.firmName}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>Firm Zip Code:</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${userDetails.firmZipCode}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>Membership Type:</strong></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${userDetails.membershipType || 'Not specified'}</td>
          </tr>
        </table>

        <p style="margin-bottom: 24px;">
         If any of this information is incorrect or needs updating, just send an email to 
          <a href="mailto:${this.config.supportEmail}" style="color: #0070CD; text-decoration: none;">
            ${this.config.supportEmail}
          </a>
          and let us know — we’ll take care of it.
        </p>
        
        <p style="margin-bottom: 24px;">
         We’re hard at work preparing something truly valuable for attorneys and millions of Americans. We’ll be in touch as we get closer to launch. Thanks again for trusting <strong>LegalRescue</strong>.
        </p>
        
        <div style="margin-top: 32px;">
          <p style="margin-bottom: 8px;">Best regards,</p>
          <p style="font-weight: bold;">The LegalRescue Team</p>
        </div>
        
        <div style="margin-top: 40px; font-size: 12px; color: #6b7280; border-top: 1px solid #eee; padding-top: 16px;">
          <a href="mailto:${this.config.supportEmail}" style="color: #0070CD; text-decoration: none;">
            📩 ${this.config.supportEmail}
          </a>
           <div style="margin-top: 20px;">
           <img src="${this.config.emailLogoPath}" alt="LegalRescue.ai Logo" style="max-width: 300px;">
      </div>
        </div>
      </div>
    `;
  }
}
