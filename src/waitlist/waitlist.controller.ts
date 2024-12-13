/* eslint-disable prettier/prettier */
import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('save')
  async addToWaitlist(@Body() data: any) {
    try {
      const result = await this.waitlistService.addToWaitlist(data);
      if (!result) {
        // Partial data processed, awaiting further fields
        return { message: 'Email saved. Awaiting additional data.' };
      }
      // All data processed successfully
      return { message: 'Data saved successfully.', data: result };
    } catch (error) {
      console.error('Error in WaitlistController:', error);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
