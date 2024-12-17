/* eslint-disable prettier/prettier */
import { Controller, Post, Body, Get, HttpException, HttpStatus } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('save')
  async addToWaitlist(@Body() data: any) {
    try {
      const result = await this.waitlistService.addToWaitlist(data);
      if (!result) {
        return { message: 'Email saved. Awaiting additional data.' };
      }
      return { message: 'Data saved successfully.', data: result };
    } catch (error) {
      console.error('Error in WaitlistController:', error);
      throw new HttpException(`Failed to save data: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
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
}
