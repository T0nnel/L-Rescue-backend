import { Injectable, Logger } from '@nestjs/common';
import { CreateAdminDto } from '../dtos/admin.createAdminDto';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from 'src/supabase/supabase.service';
import { TABLES } from 'src/attorney-auth/attorney-auth.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly supabaseClient: SupabaseClient;

  /**
   * Inject superbase service
   */
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
  ) {
    this.supabaseClient = supabaseService.getClient();
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  }

  public async createAdmin(createAdminDto: CreateAdminDto): Promise<any> {
    //Check if such admin exist before
    const { email, password } = createAdminDto;

    const existingAdmin = await this.findAdminByEmail(email);

    if (existingAdmin) {
      this.logger.warn('Admin with this email already exists', { email });
      throw new Error('Admin with this email already exists');
    }
    try {
      const hashedPassword = await this.hashPassword(password);

      const adminData = {
        ...createAdminDto,
        password: hashedPassword,
      };
      const newAdmin = await this.createAdminUser(adminData);

      // Generate JWT token
      const token = this.jwtService.sign({
        email: newAdmin.email,
        sub: newAdmin.id,
        privilege: newAdmin.privilege,
      });

      return {
        admin: newAdmin,
        token,
      };
    } catch (e) {
      this.logger.error(`SignUp process failed: ${e.message}`, {
        e,
        email,
      });
      throw e;
    }
  }

  public async findAdminByEmail(email: string): Promise<any> {
    const { data, error } = await this.supabaseClient
      .from(TABLES.ADMIN)
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error checking attorney existence: ${error.message}`, {
        email,
      });
      throw new Error(`Failed to check attorney existence: ${error.message}`);
    }

    return data;
  }

  public async createAdminUser(data: CreateAdminDto): Promise<any> {
    const { data: newAdmin, error } = await this.supabaseClient
      .from(TABLES.ADMIN)
      .insert([data])
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Error creating admin: ${error.message}`, {
        data,
      });
      throw new Error(`Failed to create admin: ${error.message}`);
    }

    return newAdmin;
  }
}
