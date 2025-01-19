/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { Request } from 'express'; // Import the Request type for accessing the client IP
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class WaitlistService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Add user data to the waitlist.
   * @param data - The data to be added to the waitlist.
   * @param req - The request object to extract the client's IP address.
   */
  async addToWaitlist(data: any, req: Request) {
    try {
      // Extract the client's IP address and ensure it is a string
      let clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
      
      // If x-forwarded-for returns an array, get the first IP address
      if (Array.isArray(clientIp)) {
        clientIp = clientIp[0];
      }
  
      console.log('Extracted Client IP:', clientIp); // Debugging line to log IP
  
      // Pass the data and client IP to the Supabase service
      return await this.supabaseService.insertData(data, clientIp);
    } catch (error) {
      console.error('Error in WaitlistService:', error);
      throw new Error(`WaitlistService error: ${error.message}`);
    }
  }
  /**
   * Retrieve the most recent email from the waitlist.
   * @returns The most recent email address.
   */
  async getEmail(): Promise<string | null> {
    try {
      const email = await this.supabaseService.getEmail();
      return email;
    } catch (error) {
      console.error('Error in WaitlistService while retrieving email:', error);
      throw new Error(`WaitlistService error in fetching email: ${error.message}`);
    }
  }

  /**
   * Get the total count of entries in the waitlist.
   * @returns The count of entries in the waitlist.
   */
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
