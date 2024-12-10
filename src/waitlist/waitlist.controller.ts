/* eslint-disable prettier/prettier */
import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { SaveUserDataDto } from './dto/save-user-data.dto'; // DTO for data validation

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  /**
   * Saves user data into the waitlist
   * @param userData The data to be saved
   * @returns Response with success or failure status
   */
  @Post('save')
  async saveUserData(@Body() userData: SaveUserDataDto) {
    try {
      const savedData = await this.waitlistService.saveWaitlistData(userData);
      return {
        success: true,
        message: 'User data saved successfully.',
        data: savedData,
      };
    } catch (error) {
      // Log the error and throw a proper exception
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to save user data.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
