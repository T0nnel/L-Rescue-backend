/* eslint-disable prettier/prettier */
import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('save')
  async addToWaitlist(@Body() data: any) {
    try {
      console.log('Incoming request data:', data);

      const result = await this.waitlistService.addToWaitlist(data);

      if (!result) {
        return { message: 'Partial data saved. Awaiting additional details.' };
      }

      return { message: 'Data saved successfully.', data: result };
    } catch (error) {
      console.error('Error in WaitlistController:', error.message);
      throw new HttpException(
        `Error saving data: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
