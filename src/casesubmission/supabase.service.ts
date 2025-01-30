/* eslint-disable prettier/prettier */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { CreateCaseDto } from './dto/createcase.dto';

@Injectable()
export class SupabaseService {
  private readonly supabase;

  private readonly tableName = 'case_submissions';

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new InternalServerErrorException(
        'Supabase environment variables not configured properly.',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Create a new case submission in the Supabase database
   */
  async createSubmission(createCaseDto: CreateCaseDto) {
    const submissionId = Math.floor(Math.random() * 10000); // Generates a random integer
    const submission = {
      id: submissionId,
      ...createCaseDto,
      submittedAt: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert([submission]);

    if (error) {
      throw new InternalServerErrorException(`Supabase error: ${error.message}`);
    }

    return data;
  }

  /**
   * Retrieve all case submissions from Supabase
   */
  async getAllSubmissions() {
    const { data, error } = await this.supabase 
      .from(this.tableName)
      .select('*');

    if (error) {
      throw new InternalServerErrorException(`Supabase error: ${error.message}`);
    }

    return data;
  }
}

