/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail', // Use your email service (e.g., Gmail, SMTP server)
      auth: {
        user: process.env.EMAIL_USER, // Environment variable for email
        pass: process.env.EMAIL_PASS, // Environment variable for password
      },
    });
  }

  
  /* async onModuleInit() {
    // Debug: Send a test email when the app starts
    try {
      await this.sendNoReplyEmail('totimbugz@gmail.com');
      console.log('Test email sent successfully');
    } catch (error) {
      console.error('Error sending test email:', error.message);
    }
  }
 */
  async sendNoReplyEmail(email: string): Promise<void> {
    const mailOptions = {
      from: '"LegalRescue.ai" <no-reply@legalrescue.ai>',
      to: email,
      subject: 'Test Email from LegalRescue.ai',
      text: 'This is a test email. If you received this, the email service is working.',
    };

    await this.transporter.sendMail(mailOptions);
  }
}
