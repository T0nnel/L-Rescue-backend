/* eslint-disable prettier/prettier */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

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

    this.collectedData = { ...this.collectedData, ...data };

    if (this.collectedData.licenses) {
      let states = Object.keys(this.collectedData.licenses);

      if (states.length > 0) {
        this.collectedData.state = states.join(', '); 
      }

      states.forEach(state => {
        if (!this.collectedData.licenses[state]) {
          this.collectedData.licenses[state] = null;
        }
      });
    }

    // Step 1
    try {
      if (!this.emailId && this.collectedData.email) {
        console.log('Checking if email already exists in waitlist...');
        
        // Check if email already exists
        const { data: existingUser, error: checkError } = await this.supabase
          .from('waitlist')
          .select('id, waitlistPosition')
          .eq('email', this.collectedData.email)
          .single();
          
        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" error
          console.error('Error checking existing email:', checkError);
          throw new Error(`Failed to check existing email: ${checkError.message}`);
        }
        
        // If user exists, use their ID and return their data
        if (existingUser) {
          console.log('Email already exists in waitlist with ID:', existingUser.id);
          this.emailId = existingUser.id;
          
          return { 
            existing: true, 
            message: 'This email is already on our waitlist',
            waitlistPosition: existingUser.waitlistPosition || null
          };
        }
        
        // If email doesn't exist, proceed with insertion
        console.log('Inserting new email into Supabase...');
        
        const { data: insertedEmail, error: emailError } = await this.supabase
          .from('waitlist')
          .insert([{ email: this.collectedData.email }])
          .select('id') 
          .single(); 

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

        return { existing: false, message: 'Email added successfully' }; 
      }

      // Step 2
      if (this.emailId && this.collectedData.selectedMembership) {
        console.log('Attempting to update record with collected data...');

        const { data: currentRecord, error: recordError } = await this.supabase
          .from('waitlist')
          .select('waitlistPosition, email')
          .eq('id', this.emailId)
          .single();
          
        if (recordError) {
          console.error('Error checking current record:', recordError);
          throw new Error(`Failed to check current record: ${recordError.message}`);
        }
        
       
        
        let waitlistPosition = currentRecord?.waitlistPosition;
        
 
        if (waitlistPosition === null || waitlistPosition === undefined) {
          console.log('Assigning a new waitlist position...');
          
    
          const { data: maxPositionData, error: maxPositionError } = await this.supabase
            .from('waitlist')
            .select('waitlistPosition')
            .not('id', 'eq', this.emailId) // Exclude current record
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
              .not('id', 'eq', this.emailId); 
              
            if (countError) {
              console.error('Error counting waitlist records with positions:', countError);
              throw new Error(`Failed to count records: ${countError.message}`);
            }
            
            waitlistPosition = (recordsWithPositions?.length || 0) + 1;
          }
          
        ;
        } else {
          console.log('User already has waitlist position:', waitlistPosition);
        }

        const { data: updatedData, error: updateError } = await this.supabase
          .from('waitlist')
          .update({
            ...this.collectedData, 
            email: undefined, 
            state: this.collectedData.state, 
            licenses: this.collectedData.licenses,
            waitlistPosition: waitlistPosition 
          }) 
          .eq('id', this.emailId)
          .select()
        if (updateError) {
          console.error('Error updating Supabase record:', updateError);
          throw new Error(`Failed to update record: ${updateError.message}`);
        }

       
        try {
          await this.syncToEngageBay(updatedData[0]);
        } catch (engageBayError) {
          console.error('Failed to sync with EngageBay:', engageBayError);
        }
        
        const result = {
          ...updatedData[0],
          existing: !!currentRecord.waitlistPosition
        };
        
        this.collectedData = {};
        this.emailId = null; 

        return result; 
      }

    
      return null;
    } catch (error) {
      console.error('Error during Supabase operation:', error);
      throw new Error(`Supabase operation error: ${error.message}`);
    }
  }


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
            name: "email",
            value: userData.email || '',
            field_type: "TEXT",
            is_searchable: false,
            type: "SYSTEM"
          },
          {
            name: "phone",
            value: userData.phone || '',
            field_type: "TEXT",
            is_searchable: false,
            type: "SYSTEM"
          },
          {
            name: "address.address",
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
            value: userData.selectedMembership.includes("Single Attorney") ? "Solo-Account" : "Firm-Wide",
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
          }
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
  
      console.log("engageBayData prepared:", engageBayData);
      
      // Send data to EngageBay
      const response = await axios.post(
        'https://app.engagebay.com/dev/api/panel/subscribers/subscriber',
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
