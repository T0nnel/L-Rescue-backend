/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

dotenv.config();

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabaseUrl: string = process.env.SUPABASE_URL;
  private supabaseKey: string = process.env.SUPABASE_KEY;
  private supabase: any;

  constructor() {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY is missing');
    }

    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
  }

  async onModuleInit() {
    await this.setupWaitlistTrigger();
  }
 
  async setupWaitlistTrigger(): Promise<void> {
    try {
      console.log('Setting up waitlist position update trigger...');

      // First create the function
      const { data: funcData, error: functionError } = await this.supabase.rpc('execute_sql', {
        sql_text: `
          CREATE OR REPLACE FUNCTION update_waitlist_positions()
          RETURNS TRIGGER AS $$
          BEGIN
              UPDATE waitlist
              SET "waitlistPosition" = "waitlistPosition" - 1
              WHERE "waitlistPosition" > OLD."waitlistPosition";
              RETURN OLD;
          END;
          $$ LANGUAGE plpgsql;
        `
      });

      if (functionError || (funcData && funcData.error)) {
        throw functionError || new Error(funcData.error);
      }

      // Then create the trigger
      const { data: triggerData, error: triggerError } = await this.supabase.rpc('execute_sql', {
        sql_text: `
          DO $$
          BEGIN
              IF NOT EXISTS (
                  SELECT 1 FROM pg_trigger 
                  WHERE tgname = 'after_waitlist_delete'
              ) THEN
                  CREATE TRIGGER after_waitlist_delete
                  AFTER DELETE ON waitlist
                  FOR EACH ROW
                  EXECUTE FUNCTION update_waitlist_positions();
              END IF;
          END $$;
        `
      });

      if (triggerError || (triggerData && triggerData.error)) {
        throw triggerError || new Error(triggerData.error);
      }

      console.log('Waitlist position update trigger setup successfully');
    } catch (error) {
      console.error('Error setting up waitlist trigger:', error);
    }
}
  /**
   * Create a user with email only
   * @param email User's email
   * @returns User data or existing user information
   */
  async createUser(email: string) {
    if (!email) {
      console.error('Error: Missing email in request');
      throw new Error('No email provided');
    }

    console.log('Checking if email already exists in waitlist...');
    
    // Check if email already exists
    const { data: existingUser, error: checkError } = await this.supabase
      .from('waitlist')
      .select('id, waitlistPosition, email')
      .eq('email', email)
      .single();
      
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Error checking existing email:', checkError);
      throw new Error(`Failed to check existing email: ${checkError.message}`);
    }
    
    // If user exists, return their data
    if (existingUser) {
      console.log('Email already exists in waitlist with ID:', existingUser.id);
      
      return { 
        existing: true, 
        message: 'This email is already on our waitlist',
        waitlistPosition: existingUser.waitlistPosition || null,
        id: existingUser.id,
        email: existingUser.email
      };
    }
    
    // If email doesn't exist, proceed with insertion
    console.log('Inserting new email into Supabase...');
    
    const { data: insertedEmail, error: emailError } = await this.supabase
      .from('waitlist')
      .insert([{ email }])
      .select('id, email') 
      .single(); 

    if (emailError) {
      console.error('Error inserting email into Supabase:', emailError);
      throw new Error(`Failed to insert email: ${emailError.message}`);
    }

    if (!insertedEmail || !insertedEmail.id) {
      console.error('Failed to retrieve inserted email ID');
      throw new Error('Email insertion failed');
    }

    // Sync to EngageBay
    try {
      const data = {
        properties: [{
          name: "email",
          value: insertedEmail.email || '',
          field_type: "TEXT",
          is_searchable: false,
          type: "SYSTEM"
        }]
      };
      
      const response = await axios.post(
        'https://app.engagebay.com/dev/api/panel/subscribers/subscriber',
        data,
        {
          headers: {
            'Authorization': process.env.ENGAGEBAY_API_KEY,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.status !== 200) {
        console.error('Error syncing to EngageBay:', response.data);
      } else {
        const data= response.data
        await this.updateUserInfo(email, { contactId: data.id });
      }
    } catch (engageBayError) {
      console.error('Failed to sync with EngageBay:', engageBayError);
    }

    console.log('Email inserted successfully with ID:', insertedEmail.id);

    return { 
      existing: false, 
      message: 'Email added successfully',
      id: insertedEmail.id,
      email: insertedEmail.email
    };
  }

  /**
   * Update user information
   * @param email User's email
   * @param data Data to update
   * @returns Updated user data
   */
  async updateUserInfo(email: string, data: any) {
    if (!email) {
      console.error('Error: Missing email in request');
      throw new Error('No email provided');
    }

    if (!data) {
      console.error('Error: Missing data in request');
      throw new Error('No data provided');
    }

    console.log('Looking up user by email:', email);
    
    // Find user by email
    const { data: user, error: userError } = await this.supabase
      .from('waitlist')
      .select('id, waitlistPosition, email, contactId')
      .eq('email', email)
      .single();
      
    if (userError) {
      console.error('Error finding user by email:', userError);
      throw new Error(`Failed to find user: ${userError.message}`);
    }
    
    if (!user) {
      console.error('User not found with email:', email);
      throw new Error('User not found');
    }

    const userId = user.id;
    console.log('Found user with ID:', userId);

    // Process data before update
    const processedData = { ...data };
    
    // Process licenses if present
    if (processedData.licenses) {
      let states = Object.keys(processedData.licenses);

      if (states.length > 0) {
        processedData.state = states.join(', ');
      }

      states.forEach(state => {
        if (!processedData.licenses[state]) {
          processedData.licenses[state] = null;
        }
      });
    }

    // Calculate waitlist position if needed
    let waitlistPosition = user.waitlistPosition;
    
    if (waitlistPosition === null || waitlistPosition === undefined) {
      console.log('Assigning a new waitlist position...');
      
      const { data: maxPositionData, error: maxPositionError } = await this.supabase
        .from('waitlist')
        .select('waitlistPosition')
        .not('id', 'eq', userId) 
        .not('waitlistPosition', 'is', null)
        .order('waitlistPosition', { ascending: false })
        .limit(1);
        
      if (maxPositionError) {
        console.error('Error getting max waitlist position:', maxPositionError);
        throw new Error(`Failed to get max position: ${maxPositionError.message}`);
      }
      
      if (maxPositionData && maxPositionData.length > 0 && maxPositionData[0].waitlistPosition !== null) {
        waitlistPosition = maxPositionData[0].waitlistPosition + 1;
      } else {
        const { data: recordsWithPositions, error: countError } = await this.supabase
          .from('waitlist')
          .select('id')
          .not('waitlistPosition', 'is', null)
          .not('id', 'eq', userId); 
          
        if (countError) {
          console.error('Error counting waitlist records with positions:', countError);
          throw new Error(`Failed to count records: ${countError.message}`);
        }
        
        waitlistPosition = (recordsWithPositions?.length || 0) + 1;
      }
    } else {
      console.log('User already has waitlist position:', waitlistPosition);
    }

    // Update user data
    const { data: updatedData, error: updateError } = await this.supabase
      .from('waitlist')
      .update({
        ...processedData,
        waitlistPosition: waitlistPosition
      })
      .eq('id', userId)
      .select('*');

    if (updateError) {
      console.error('Error updating Supabase record:', updateError);
      throw new Error(`Failed to update record: ${updateError.message}`);
    }

    // Sync to EngageBay
    try {
      await this.syncToEngageBay(updatedData[0]);
    } catch (engageBayError) {
      console.error('Failed to sync with EngageBay:', engageBayError);
    }
    
    return {
      ...updatedData[0],
      existing: user.waitlistPosition !== null
    };
  }

  /**
   * Sync user data to EngageBay
   * @param userData User data to sync
   * @returns EngageBay response or null on error
   */
  async syncToEngageBay(userData: any) {
    try {
      let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (userData.created_at) {
        try {
          const createdAtDate = new Date(userData.created_at);
          timezone = createdAtDate.toString().match(/\(([^)]+)\)/)?.[1] || timezone;
        } catch (e:any) {
          console.log('Could not extract timezone from timestamp, using default', e);
        }
      }
      
      const engageBayData = {
        id: userData.contactId,
        properties: [
          {
            name: "name",
            value: userData.firstName || '',
            field_type: "TEXT",
            is_searchable: false,
            type: "SYSTEM"
          },
          {
            name: "last_name",
            value: userData.lastName || '',
            field_type: "TEXT",
            is_searchable: false,
            type: "SYSTEM"
          },
          {
            name: "phone",
            value: userData.phone|| '',
            field_type: "TEXT",
            is_searchable: false,
            type: "SYSTEM"
          },
          {
            name: "address.zip",
            value: userData.firmAddress || '',
            field_type: "TEXT",
            is_searchable: false,
            type: "SYSTEM"
          },
          {
            name: "temp",
            value: userData.firmName || '',
            field_type: "TEXT",
            is_searchable: false,
            type: "SYSTEM"
          },
          {
            name: "Interested_in_Membership_Type",
            value: userData.selectedMembership?.includes("Single Attorney") ? "Solo-Account" : "Firm-Wide",
            field_type: "LIST",
            is_searchable: true,
            type: "CUSTOM"
          },
          {
            name: "timezone",
            value: timezone,
            field_type: "LIST",
            is_searchable: true,
            type: "SYSTEM"
          },
          {
            name: "sendEmailUpdates",
            value: userData.sendEmailUpdates ? "true" : "false",
            field_type: "CHECKBOX",
            is_searchable: true,
            type: "CUSTOM"
          },
          {
            name: "IP_Address",
            value: userData.clientIp || '',
            field_type: "TEXT",
            is_searchable: true,
            type: "CUSTOM"
          },
        ]
      };
      
      if (userData.legalPractices && userData.legalPractices.length > 0) {
        engageBayData.properties.push({
          name: "Legal_Practice_Category",
          value: userData.legalPractices.join(','),
          field_type: "MULTICHECKBOX",
          is_searchable: true,
          type: "CUSTOM"
        });
      }
      
      if (userData.licenses && Object.keys(userData.licenses).length > 0) {
        const licenseStates = Object.entries(userData.licenses)
          .filter(([_, licenseNumber]) => licenseNumber)
          .map(([state, _]) => state);
        
        if (licenseStates.length > 0) {
          engageBayData.properties.push({
            name: "State_Bar_License(s)",
            value: licenseStates.join(','),
            field_type: "MULTICHECKBOX",
            is_searchable: true,
            type: "CUSTOM"
          });
        }
        
        Object.entries(userData.licenses).forEach(([state, licenseNumber]) => {
          if (licenseNumber) {
            engageBayData.properties.push({
              name: `Bar_License_Number_-_${state}`,
              value: licenseNumber as string,
              field_type: "TEXT",
              is_searchable: true,
              type: "CUSTOM"
            });
          }
        });
      }
      
      // Send data to EngageBay
      const response = await axios.put(
        'https://app.engagebay.com/dev/api/panel/subscribers/update-partial',
        engageBayData,
        {
          headers: {
            'Authorization': process.env.ENGAGEBAY_API_KEY,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error syncing to EngageBay:', error.message);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
      return null;
    }
  }

  /**
   * Get most recent email from waitlist
   * @returns Latest email or null
   */
  async getEmail(): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('waitlist')
        .select('email')
        .order('id', { ascending: false }) 
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

  /**
   * Get Supabase client
   * @returns SupabaseClient instance
   */
  getClient(): SupabaseClient {
    return this.supabase;
  }
}