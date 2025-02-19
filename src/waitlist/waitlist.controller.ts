/* eslint-disable prettier/prettier */
import { Controller, Post, Body, Get, HttpException, HttpStatus, Req } from '@nestjs/common';
import { Request } from 'express';  
import { WaitlistService } from './waitlist.service';
import { SupabaseService } from '../supabase/supabase.service';  // Import the service

@Controller('waitlist')
export class WaitlistController {
  constructor(
    private readonly waitlistService: WaitlistService,
    private readonly supabaseService: SupabaseService  // Inject SupabaseService
  ) {}

  /**
   * Endpoint to save data and email to the waitlist.
   * @param data - The data to be added.
   * @param req - The request object for extracting the client's IP.
   * @returns A message indicating the result.
   */
  @Post('save')
  async addToWaitlist(@Body() data: any, @Req() req: Request) {
    try {
      // Get the client IP address
      const clientIp = this.getIpAddress(req);

      // Append client IP to data
      const enrichedData = { ...data, clientIp };

      // Save to Supabase
      await this.supabaseService.insertData(enrichedData);  // Now it will work

      // Pass data to waitlist service (if needed)
      const result = await this.waitlistService.addToWaitlist(enrichedData, req);

      return { message: 'Data saved successfully.', data: result };
    } catch (error) {
      console.error('Error in WaitlistController:', error);
      throw new HttpException(
        `Failed to save data: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  getIpAddress(request: Request): string {
    try {
      const requestIpList = request.headers['x-forwarded-for'] as string || '';
      let clientIp = requestIpList.includes(',')
        ? requestIpList.split(',')[0].trim()
        : requestIpList.trim();

        if (clientIp === '::1') {
          clientIp = '127.0.0.1';
        }    

      clientIp = clientIp || request.connection.remoteAddress || request.socket.remoteAddress || request.ip;
      return clientIp;
    } catch (error) {
      console.error('Error retrieving IP:', error);
      throw new HttpException('Failed to retrieve IP', HttpStatus.INTERNAL_SERVER_ERROR);
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
