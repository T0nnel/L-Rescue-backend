/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SaveUserDataDto } from './dto/save-user-data.dto'; // DTO for data validation

@Injectable()
export class WaitlistService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Saves the user data into the waitlist by calling the Supabase service
   * @param data The user data to be saved
   * @returns The result of the data insertion
   */
  async saveWaitlistData(data: SaveUserDataDto) {
    try {
      // Call Supabase service to insert the data
      const savedData = await this.supabaseService.insertData(data);
      return savedData;
    } catch (error) {
      // Handle errors from Supabase or other issues
      throw new Error('Error saving data to Supabase: ' + error.message);
    }
  }
}
