/* eslint-disable prettier/prettier */
import { Controller, Post, Body, HttpCode, HttpStatus, Logger, BadRequestException, HttpException, InternalServerErrorException } from '@nestjs/common';
import { MailerService } from './mailer.service';

interface UserDetails {
  firstName?: string;
  lastName?: string;
  email: string;  
  barLicenses?: Array<{
    state: string;
    licenseNumber: string;
  }>;
  legalPractices?: string[];
  phone?: string;
  firmName?: string;
  firmZipCode?: string;
  membershipType?: string;
}

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
async sendSecuredEmail(
  @Body() body: { to: string; userDetails: Partial<UserDetails> }
): Promise<{ success: boolean; message: string }> {
  const { to, userDetails } = body;

  // Validate input
  if (!to || typeof to !== 'string') {
    this.logger.error('Email address is required', { endpoint: 'secured' });
    throw new BadRequestException('Email address is required');
  }

  if (!this.isValidEmail(to)) {
    this.logger.error('Invalid email format', { email: to, endpoint: 'secured' });
    throw new BadRequestException('Invalid email address format');
  }
  

  try {
    this.logger.log('Initiating secured email', { 
      email: to,
      hasUserDetails: !!userDetails,
      endpoint: 'secured' 
    });

    await this.mailerService.sendSecuredEmail(to, userDetails);

    this.logger.log('Secured email sent successfully', { 
      email: to,
      endpoint: 'secured' 
    });

    return {
      success: true,
      message: 'Secured email sent successfully',
    };
  } catch (error) {
    this.logger.error('Failed to send secured email', {
      email: to,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      endpoint: 'secured'
    });

    if (error instanceof HttpException) {
      throw error;
    }

    throw new InternalServerErrorException('Failed to send secured email');
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
