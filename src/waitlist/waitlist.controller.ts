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
      
      // Case when partial data (email) was saved earlier
      if (!result) {
        return { message: 'Email saved. Awaiting additional data (membership).' };
      }

      // Case when both email and membership type have been processed successfully
      return { message: 'Data saved successfully.', data: result };
    } catch (error) {
      console.error('Error in WaitlistController:', error);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
