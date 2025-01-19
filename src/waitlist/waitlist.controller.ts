/* eslint-disable prettier/prettier */
import { Controller, Post, Body, Get, HttpException, HttpStatus, Req } from '@nestjs/common';
import { Request } from 'express';  // Import the Request type
import { WaitlistService } from './waitlist.service';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  /**
   * Endpoint to save data and email to the waitlist.
   * @param data - The data to be added.
   * @param req - The request object for extracting the client's IP.
   * @returns A message indicating the result.
   */
  @Post('save')
  async addToWaitlist(@Body() data: any, @Req() req: Request) {
    try {
      // Pass both data and client IP (from req) to the service
      const result = await this.waitlistService.addToWaitlist(data, req);
      
      if (!result) {
        return { message: 'Email saved. Awaiting additional data.' };
      }

      return { message: 'Data saved successfully.', data: result };
    } catch (error) {
      console.error('Error in WaitlistController:', error);
      throw new HttpException(
        `Failed to save data: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Endpoint to get the most recent email added to the waitlist.
   * @returns The most recent email in the waitlist.
   */
  @Get('email')
  async getWaitlistEmail() {
    try {
      const email = await this.waitlistService.getEmail();
      return { email };  
    } catch (error) {
      console.error('Error in WaitlistController while fetching email:', error);
      throw new Error(`Failed to get email: ${error.message}`);
    }
  }

  /**
   * Endpoint to get the total count of items in the waitlist.
   * @returns The total count of items in the waitlist.
   */
  @Get('count')
  async getWaitlistCount() {
    const total = await this.waitlistService.getWaitlistCount();
    return { total };
  } 
}
