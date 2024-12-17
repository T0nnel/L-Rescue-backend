/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class WaitlistService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async addToWaitlist(data: any) {
    try {
      return await this.supabaseService.insertData(data);
    } catch (error) {
      console.error('Error in WaitlistService:', error);
      throw new Error(`WaitlistService error: ${error.message}`);
    }
  }
  
  async getEmail(): Promise<string | null> {
    try {
      const email = await this.supabaseService.getEmail();
      return email; 
    } catch (error) {
      console.error('Error in WaitlistService while retrieving email:', error);
      throw new Error(`WaitlistService error in fetching email: ${error.message}`);
    }
  }
}
