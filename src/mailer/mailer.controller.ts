/* eslint-disable prettier/prettier */
import { Controller, Post, Body, HttpCode, HttpStatus, Logger, BadRequestException } from '@nestjs/common';
import { MailerService } from './mailer.service';

@Controller('mailer')
export class MailerController {
  private readonly logger = new Logger(MailerController.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * Sends a waitlist email.
   * @param body - The request body containing the recipient email address.
   */

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendEmail(@Body() body: { to: string }) {
    const { to } = body;

    if (!this.isValidEmail(to)) {
      this.logger.error(`Invalid email address provided: ${to}`);
      throw new BadRequestException('Invalid email address.');
    }

    try {
      this.logger.log(`Attempting to send waitlist email to: ${to}`);
      const response = await this.mailerService.sendWaitlistFollowUp(to);
      this.logger.log(`Waitlist email sent successfully to: ${to}`);
      return {
        success: true,
        message: 'Waitlist email sent successfully.',
        data: response,
      };
    } catch (error) {
      this.logger.error(`Failed to send waitlist email to: ${to}`, error.message || error);
      throw error;
    }
  }

  /**
   * Sends a security-related email.
   * @param body - The request body containing the recipient email address.
   */
  @Post('secured')
  @HttpCode(HttpStatus.OK)
  async securedEmail(@Body() body: { to: string }) {
    const { to } = body;

    if (!this.isValidEmail(to)) {
      this.logger.error(`Invalid email address provided: ${to}`);
      throw new BadRequestException('Invalid email address.');
    }

    try {
      this.logger.log(`Attempting to send secured email to: ${to}`);
      const response = await this.mailerService.securedEmail(to);
      this.logger.log(`Security email sent successfully to: ${to}`);
      return {
        success: true,
        message: 'Secured email sent successfully.',
        data: response,
      };
    } catch (error) {
      this.logger.error(`Failed to send secured email to: ${to}`, error.message || error);
      throw error;
    }
  }

  /**
   * Validates an email address.
   * @param email - The email address to validate.
   * @returns True if the email address is valid; otherwise, false.
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^\S+@\S+\.\S+$/;
    return emailRegex.test(email);
  }
}
