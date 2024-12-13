/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js'; // Import the createClient function

// Load environment variables from .env file
dotenv.config();
@Injectable()
export class SupabaseService {
  private supabaseUrl: string = process.env.SUPABASE_URL;
  private supabaseKey: string = process.env.SUPABASE_KEY;
  private supabase: any;
  private collectedData: any = {}; // Temporary in-memory storage for accumulated data
  private emailId: string | null = null; // Store email ID after initial insertion

  constructor() {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY is missing');
    }

    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
  }

  async insertData(data: any) {
    console.log('Received data:', data);

    if (!data) {
      console.error('Error: Missing data in request');
      throw new Error('No data provided');
    }

    // Accumulate received data
    this.collectedData = { ...this.collectedData, ...data };

    try {
      if (this.collectedData.email && !this.emailId) {
        // Insert email if not saved yet
        const { data: insertedEmail, error: emailError } = await this.supabase
          .from('waitlist')
          .insert([{ email: this.collectedData.email }])
          .select('id')
          .single();

        if (emailError) {
          console.error('Error inserting email into Supabase:', emailError);
          throw new Error(`Supabase email insert error: ${emailError.message}`);
        }

        if (!insertedEmail || !insertedEmail.id) {
          console.error('Failed to retrieve inserted email ID');
          throw new Error('Email insertion failed');
        }

        this.emailId = insertedEmail.id;
        console.log('Email inserted successfully with ID:', this.emailId);

        // Wait for further data (membership type)
        return null; // This returns until we get all data
      }

      // Now that email is set, we validate membership
      if (this.collectedData.selectedMembership) {
        const validMemberships = ['Single Attorney', 'Firm Membership'];
        if (!validMemberships.includes(this.collectedData.selectedMembership)) {
          console.error('Invalid membership type:', this.collectedData.selectedMembership);
          throw new Error('Invalid membership type. Allowed values are "Single Attorney" or "Firm Membership".');
        }

        const { data: updatedData, error: updateError } = await this.supabase
          .from('waitlist')
          .update({ ...this.collectedData, email: undefined }) // Exclude email to prevent update clash
          .eq('id', this.emailId);

        if (updateError) {
          console.error('Error updating Supabase record:', updateError);
          throw new Error(`Supabase update error: ${updateError.message}`);
        }

        console.log('Record updated successfully:', updatedData);

        // Reset data after update
        this.collectedData = {};
        this.emailId = null;

        return updatedData;
      }

      console.log('Waiting for membership data...');
      return null;
    } catch (error) {
      console.error('Error during Supabase operation:', error);
      throw new Error(`Supabase operation error: ${error.message}`);
    }
  }
}
