/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly resendClient: Resend;
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.resendClient = new Resend(this.configService.get('RESEND_API_KEY'));
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('MAILTRAP_HOST'),
      port: 587,
      secure: false,
      auth: {
        user: this.configService.get('MAIL_USER'),
        pass: this.configService.get('MAIL_PASSWORD'),
      },
    });
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

  private async send(
    to: string,
    subject: string,
    htmlContent: string,
  ): Promise<any> {
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

  async approveEmail(
    attorneyEmail: string,
    attorneyName: string,
    message: string,
  ): Promise<void> {
    const mailOptions = {
      from: 'LegalRescue <noreply@legalrescue.ai>',
      to: attorneyEmail,
      subject: 'ACCOUNT APPROVED',
      html: `
        <h2>Hello ${attorneyName},</h2>
        <p>It's a great pleasure to inform you that your account has been approved you can now login to access your dashboard page .</p>
        <p>${message}</p>
        <p>Click here to be redirected to your dashboard ${this.configService.get('FRONTEND_URL')}</p>
        <br>
        <p>Best regards,</p>
        <p>The LegalRescue Team</p>
      `,
    };

    const result = await this.transporter.sendMail(mailOptions);
    this.logger.log(`Approval email sent to ${attorneyEmail}`);
    return result;
  }

  async sendRejectionEmail(
    attorneyEmail: string,
    attorneyName: string,
    rejectionMessage: string,
  ): Promise<void> {
    const mailOptions = {
      from: 'LegalRescue <noreply@legalrescue.ai>',
      to: attorneyEmail,
      subject: 'ADDITIONAL INFORMATION REQUIRED - LegalRescue Application',
      html: `
        <h2>Hello ${attorneyName},</h2>
        <p>Thank you for your application to LegalRescue. We need some additional information to proceed:</p>
        <p>${rejectionMessage}</p>
        <p>Please update your information at: ${this.configService.get('FRONTEND_URL')}/signup</p>
        <br>
        <p>Best regards,</p>
        <p>The LegalRescue Team</p>
      `,
    };

    const result = await this.transporter.sendMail(mailOptions);
    this.logger.log(`Rejection email sent to ${attorneyEmail}`);
    return result;
  }

  async sendDeactivationEmail(
    attorneyEmail: string,
    attorneyName: string,
    rejectionMessage: string,
  ): Promise<void> {
    const mailOptions = {
      from: 'LegalRescue <noreply@legalrescue.ai>',
      to: attorneyEmail,
      subject: 'ACCOUNT DEACTIVATION',
      html: `
        <h2>Hello ${attorneyName},</h2>
        <p>We are sorry to notify you your account has been deactivated </p>
        <p>${rejectionMessage}</p>
        <p>Will get in touch and help you activate your account</p>
        <br>
        <p>Best regards,</p>
        <p>The LegalRescue Team</p>
      `,
    };

    const result = await this.transporter.sendMail(mailOptions);
    this.logger.log(`Rejection email sent to ${attorneyEmail}`);
    return result;
  }

  async sendSuspensionEmail(
    attorneyEmail: string,
    attorneyName: string,
    rejectionMessage: string,
  ): Promise<void> {
    const mailOptions = {
      from: 'LegalRescue <noreply@legalrescue.ai>',
      to: attorneyEmail,
      subject: 'ACCOUNT SUSPENSION',
      html: `
        <h2>Hello ${attorneyName},</h2>
        <p>We are sorry to notify you your account has been suspended </p>
        <p>${rejectionMessage}</p>
        <p>Will get in touch and help you activate your account</p>
        <br>
        <p>Best regards,</p>
        <p>The LegalRescue Team</p>
      `,
    };

    const result = await this.transporter.sendMail(mailOptions);
    this.logger.log(`Rejection email sent to ${attorneyEmail}`);
    return result;
  }
}
