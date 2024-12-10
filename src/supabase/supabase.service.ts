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
  private supabase:any;
  private collectedData: any = {}; // Temporary in-memory storage for accumulated data

  constructor() {
    // Ensure that the environment variables are set
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY is missing');
    }

    // Initialize the supabase client
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
  }

  async insertData(data: any) {
    // Log the received data to check its structure
    console.log('Received data:', data);

    // Check if data is provided
    if (!data) {
      console.error('Error: Missing data in request');
      throw new Error('No data provided');
    }

    // Merge the incoming data with the existing data in memory
    this.collectedData = { ...this.collectedData, ...data };

    // Check if the last expected key ('selectedMembership') is in the accumulated data
    if (this.collectedData.selectedMembership) {
      // Restructure the 'licenses' field with state as the key and licenseNumber as value
      if (this.collectedData.licenses) {
        const states = Object.keys(this.collectedData.licenses);
        const licenses = Object.values(this.collectedData.licenses);

        // Create a new structure where the 'state' is the key and 'licenseNumber' is the value
        const formattedLicenses = states.reduce((acc, state, index) => {
          acc[`${state}`] = licenses[index];  // Use the state as the key
          return acc;
        }, {});

        // Update the collectedData to use the formatted licenses structure
        this.collectedData.licenses = formattedLicenses;

        // Set 'state' to be an array of all the states
        this.collectedData.state = states.map(state => `${state}`);
      }

      try {
        // Log the final data that will be inserted
        console.log('Inserting accumulated data into Supabase:', this.collectedData);

        // Insert the final data into Supabase
        const { data: insertedData, error } = await this.supabase
          .from('waitlist')
          .insert([this.collectedData]);

        // Check for errors from Supabase
        if (error) {
          console.error('Error inserting data into Supabase:', error);
          throw new Error(`Supabase insert error: ${error.message}`);
        }

        // Log success and return the inserted data
        console.log('Data inserted successfully:', insertedData);

        // Clear the accumulated data after insertion
        this.collectedData = {}; // Reset for next submission

        return insertedData;
      } catch (error) {
        // Log the error and throw it
        console.error('Insert data error:', error);
        throw new Error(`Insert data error: ${error.message}`);
      }
    } else {
      console.log('Waiting for more data...');
      return null; // No insert until the last key is received
    }
  }
  
}
