/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
  async getWaitlistCount(): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const { data, error, count } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true }); // Count rows without fetching all data

    if (error) {
      console.error('Error fetching waitlist count:', error);
      throw new Error('Failed to fetch waitlist count.');
    }

    return count || 0;
  }
}
