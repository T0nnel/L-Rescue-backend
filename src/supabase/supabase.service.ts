/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
dotenv.config();

@Injectable()
export class SupabaseService {
  private supabaseUrl: string = process.env.SUPABASE_URL || '';
  private supabaseKey: string = process.env.SUPABASE_KEY || '';
  private supabase: any;
  private collectedData: any = {}; // Temporary in-memory storage for accumulated data
  private emailId: string | null = null; // Store email ID after initial insertion

  constructor() {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Missing Supabase configuration: SUPABASE_URL or SUPABASE_KEY');
    }

    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
  }

  async insertData(data: any) {
    console.log('Received data:', data);

    if (!data) {
      console.error('No data provided for insertion');
      throw new Error('No data provided');
    }

    // Merge with existing collected data
    this.collectedData = { ...this.collectedData, ...data };

    try {
      if (this.collectedData.selectedMembership) {
        const validMemberships = ['Single Attorney', 'Firm Membership'];
        if (!validMemberships.includes(this.collectedData.selectedMembership)) {
          console.error(`Invalid membership type: ${this.collectedData.selectedMembership}`);
          throw new Error('Invalid membership type. Choose "Single Attorney" or "Firm Membership".');
        }
      }

      if (!this.emailId && this.collectedData.email) {
        const { data: emailRecord, error: emailError } = await this.supabase
          .from('waitlist')
          .insert([{ email: this.collectedData.email }])
          .select('id')
          .single();

        if (emailError) {
          console.error('Supabase insert error:', emailError);
          throw new Error(`Supabase insert error: ${emailError.message}`);
        }

        if (!emailRecord || !emailRecord.id) {
          throw new Error('Email insertion failed. No ID returned.');
        }

        this.emailId = emailRecord.id;
        console.log('Email inserted successfully with ID:', this.emailId);

        return null; // Return null, awaiting full data
      }

      if (this.emailId && this.collectedData.selectedMembership) {
        const { data: updatedRecord, error: updateError } = await this.supabase
          .from('waitlist')
          .update({ ...this.collectedData, email: undefined })
          .eq('id', this.emailId);

        if (updateError) {
          console.error('Supabase update error:', updateError);
          throw new Error(`Supabase update error: ${updateError.message}`);
        }

        console.log('Record updated successfully:', updatedRecord);

        this.collectedData = {};
        this.emailId = null;
        return updatedRecord;
      }

      console.log('Awaiting additional data to complete the process...');
      return null;
    } catch (error) {
      console.error('Error during Supabase operation:', error);
      throw new Error(error.message || 'Failed Supabase operation');
    }
  }
}
