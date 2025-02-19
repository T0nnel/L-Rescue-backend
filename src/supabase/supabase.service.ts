/* eslint-disable prettier/prettier */
/* eslint-disable prefer-const */
import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

@Injectable()
export class SupabaseService {
  private supabaseUrl: string = process.env.SUPABASE_URL; 
  private supabaseKey: string = process.env.SUPABASE_KEY;
  private supabase: any;
  private collectedData: any = {}; 
  private emailId: string | null = null; 

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
  
    // Combine received data with any previously stored data
    this.collectedData = { ...this.collectedData, ...data };
  
    if (this.collectedData.licenses) {
      const states = Object.keys(this.collectedData.licenses);
  
      // If any states are found in the licenses, add to state
      if (states.length > 0) {
        this.collectedData.state = states.join(', ');
      }
  
      // Set licenses as null if not available for any state
      states.forEach(state => {
        if (!this.collectedData.licenses[state]) {
          this.collectedData.licenses[state] = null;
        }
      });
    }
  
    // Step 1 - Inserting data if no email ID has been assigned yet
    try {
      if (!this.emailId && this.collectedData.email) {
        console.log('Inserting email into Supabase...');
  
        // Insert email into the `waitlist` table
        const { data: insertedEmail, error: emailError } = await this.supabase
          .from('waitlist')
          .insert([{ email: this.collectedData.email}])
          .select('id') // Retrieve the inserted id
          .single(); // Ensure only a single record is returned
  
        if (emailError) {
          console.error('Error inserting email into Supabase:', emailError);
          throw new Error(`Failed to insert email: ${emailError.message}`);
        }
  
        if (!insertedEmail || !insertedEmail.id) {
          console.error('Failed to retrieve inserted email ID');
          throw new Error('Email insertion failed');
        }
  
        this.emailId = insertedEmail.id;
        console.log('Email inserted successfully with ID:', this.emailId);
  
        return null; // Await more data before continuing
  
      }
  
      // Step 2 - Update the record if the email exists and we have a selectedMembership
      if (this.emailId && this.collectedData.selectedMembership) {
        console.log('Attempting to update record with collected data and IP address...');
  
        // Fetch the maximum waitlist position, so we can update the next available position
        const { data: maxPositionData, error: maxPositionError } = await this.supabase
          .from('waitlist')
          .select('waitlist_position')
          .order('waitlist_position', { ascending: false })
          .limit(1)
          .single();
   
        if (maxPositionError) {
          console.log(maxPositionError.message);
        }
  
        const nextPosition = maxPositionData?.waitlist_position
          ? maxPositionData.waitlist_position + 1
          : 1;
  
        // Update the record with additional information 
        const { data: updatedData, error: updateError } = await this.supabase
          .from('waitlist')
          .update({
            ...this.collectedData, 
            email: undefined, // Don't update email again
            state: this.collectedData.state,
            licenses: this.collectedData.licenses,
            waitlist_position: nextPosition, // Incremented position in the waitlist
          })
          .eq('id', this.emailId); // Ensure we update the correct record based on the ID
  
        if (updateError) {
          console.error('Error updating Supabase record:', updateError);
          throw new Error(`Failed to update record: ${updateError.message}`);
        }
  
        console.log('Record updated successfully with IP address:', updatedData);
  
        // Clear collected data and reset email ID after a successful update
        this.collectedData = {};
        this.emailId = null;
  
        return updatedData;
      }
  
      console.log('Waiting for more data to complete the update...');
      return null; // Await further data
  
    } catch (error) {
      console.error('Error during Supabase operation:', error);
      throw new Error(`Supabase operation error: ${error.message}`);
    }
  }  
  
  async getEmail(): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('waitlist')
        .select('email')
        .order('id', { ascending: false }) // Sort by id in descending order 
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching email from Supabase:', error);
        throw new Error('Error fetching email from Supabase.');
      }

      return data?.email || null; 
    } catch (error) {
      console.error('Error fetching email from Supabase:', error);
      throw new Error('Error fetching email.');
    }
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
