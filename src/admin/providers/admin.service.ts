import { Injectable, Logger } from '@nestjs/common';
import { CreateAdminDto } from '../dtos/admin.createAdminDto';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from 'src/supabase/supabase.service';
import { TABLES } from 'src/attorney-auth/attorney-auth.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { GetAttorneyDto } from '../dtos/get-attorney-dto';
import { Privileges } from '../enums/privileges.enum';
import { MailerService } from 'src/mailer/mailer.service';

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
    private readonly mailerService: MailerService,
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
      .select('id , firstName , lastName ,email, password')
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

  public async loginAdmin(loginAdminDto: any): Promise<any> {
    try {
      const { email, password } = loginAdminDto;

      const admin = await this.findAdminByEmail(email);

      if (!admin) {
        this.logger.warn('Admin not found', { email });
        throw new Error('Admin not found');
      }
      const isMatch = await bcrypt.compare(password, admin.password);

      if (!isMatch) {
        this.logger.warn('Invalid password', { email });
        throw new Error('Invalid password');
      }

      // Generate JWT token

      const token = this.jwtService.sign({
        email: admin.email,
        sub: admin.id,
        privilege: admin.privilege,
      });

      return {
        admin: {
          id: admin.id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          privilege: admin.privilege,
        },
        token,
      };
    } catch (error) {
      this.logger.error(`Login process failed: ${error.message}`, {
        error,
      });
      throw error;
    }
  }

  public async approveAttorney(
    attorneyId: GetAttorneyDto,
    message: string,
    token: string,
  ) {
    try {
      const decodedToken = this.jwtService.verify(token);
      const adminEmail = decodedToken.email;
      const admin = await this.findAdminByEmail(adminEmail);
      if (!admin) {
        this.logger.warn('Unauthorized admin', { adminEmail });
        throw new Error('Unauthorized admin');
      }

      // Get attorney details
      const { data: attorney, error: fetchError } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .select('email, firstName, lastName')
        .eq('id', attorneyId)
        .single();

      // Update attorney's isActive status
      const { data: updatedAttorney, error } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .update({ isActive: true, accountStatus: 'Verified account ' })
        .eq('id', attorneyId)
        .select('*')
        .single();

      await this.mailerService.approveEmail(
        attorney.email,
        `${attorney.firstName} ${attorney.lastName}`,
        message,
      );

      return {
        attorney: {
          id: updatedAttorney.id,
          firstName: updatedAttorney.firstName,
          lastName: updatedAttorney.lastName,
          email: updatedAttorney.email,
          isActive: updatedAttorney.isActive,
          accountStatus: updatedAttorney.accountStatus,
        },
        message: 'Attorney approved successfully',
      };
    } catch (e) {
      this.logger.error(`Approval process failed: ${e.message}`, {
        e,
        attorneyId,
      });
      throw e;
    }
  }

  public async deactivateAttorney(
    attorneyId: GetAttorneyDto,
    message,
    token: string,
  ) {
    try {
      const decodedToken = this.jwtService.verify(token);
      const adminEmail = decodedToken.email;
      const admin = await this.findAdminByEmail(adminEmail);
      if (!admin) {
        this.logger.warn('Unauthorized admin', { adminEmail });
        throw new Error('Unauthorized admin');
      }

      // Get attorney details
      const { data: attorney, error: fetchError } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .select('email, firstName, lastName')
        .eq('id', attorneyId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch attorney: ${fetchError.message}`);
      }

      // Update attorney's isActive status
      const { data: updatedAttorney, error } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .update({ isActive: false, accountStatus: 'Awaiting review' })
        .eq('id', attorneyId)
        .select('*')
        .single();

      // Send rejection email
      await this.mailerService.sendDeactivationEmail(
        attorney.email,
        `${attorney.firstName} ${attorney.lastName}`,
        message,
      );

      return {
        attorney: {
          id: updatedAttorney.id,
          firstName: updatedAttorney.firstName,
          lastName: updatedAttorney.lastName,
          email: updatedAttorney.email,
          isActive: updatedAttorney.isActive,
          accountStatus: updatedAttorney.accountStatus,
        },
        message: 'Attorney deactivated successfully',
      };
    } catch (e) {
      this.logger.error(`Deactivation process failed: ${e.message}`, {
        e,
        attorneyId,
      });
      throw e;
    }
  }

  public async denyAttorney(
    attorneyId: GetAttorneyDto,
    message: string,
    token: string,
  ) {
    try {
      const decodedToken = this.jwtService.verify(token);
      const adminEmail = decodedToken.email;
      const admin = await this.findAdminByEmail(adminEmail);
      if (!admin) {
        this.logger.warn('Unauthorized admin', { adminEmail });
        throw new Error('Unauthorized admin');
      }

      // Get attorney details
      const { data: attorney, error: fetchError } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .select('email, firstName, lastName')
        .eq('id', attorneyId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch attorney: ${fetchError.message}`);
      }
      // Update attorney's isActive status
      const { data: updatedAttorney, error } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .update({
          isActive: false,
          accountStatus: 'Awaiting updated information',
        })
        .eq('id', attorneyId)
        .select('*')
        .single();

      // Send rejection email
      await this.mailerService.sendRejectionEmail(
        attorney.email,
        `${attorney.firstName} ${attorney.lastName}`,
        message,
      );
      return {
        attorney: {
          id: updatedAttorney.id,
          firstName: updatedAttorney.firstName,
          lastName: updatedAttorney.lastName,
          email: updatedAttorney.email,
          isActive: updatedAttorney.isActive,
          accountStatus: updatedAttorney.accountStatus,
        },
        message: 'Attorney denied successfully',
      };
    } catch (e) {
      this.logger.error(`Approval process failed: ${e.message}`, {
        e,
        attorneyId,
      });
      throw e;
    }
  }

  public async suspendAttorney(
    attorneyId: GetAttorneyDto,
    message,
    token: string,
  ) {
    try {
      const decodedToken = this.jwtService.verify(token);
      const adminEmail = decodedToken.email;
      const admin = await this.findAdminByEmail(adminEmail);
      if (!admin) {
        this.logger.warn('Unauthorized admin', { adminEmail });
        throw new Error('Unauthorized admin');
      }

      // Get attorney details
      const { data: attorney, error: fetchError } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .select('email, firstName, lastName')
        .eq('id', attorneyId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch attorney: ${fetchError.message}`);
      }
      // Update attorney's status to suspended
      const { data: updatedAttorney, error } = await this.supabaseClient
        .from(TABLES.ATTORNEY_USERS)
        .update({
          isActive: false,
          accountStatus: 'Suspended',
        })
        .eq('id', attorneyId)
        .select('*')
        .single();

      await this.mailerService.sendSuspensionEmail(
        attorney.email,
        `${attorney.firstName} ${attorney.lastName}`,
        message,
      );

      return {
        attorney: {
          id: updatedAttorney.id,
          firstName: updatedAttorney.firstName,
          lastName: updatedAttorney.lastName,
          email: updatedAttorney.email,
          isActive: updatedAttorney.isActive,
          accountStatus: updatedAttorney.accountStatus,
          subscription_status: updatedAttorney.subscription_status,
        },
        message: 'Attorney account suspended successfully',
      };
    } catch (e) {
      this.logger.error(`Suspension process failed: ${e.message}`, {
        e,
        attorneyId,
      });
      throw e;
    }
  }
}
