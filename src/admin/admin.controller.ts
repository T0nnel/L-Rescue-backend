import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { CreateAdminDto } from './dtos/admin.createAdminDto';
import { AdminService } from './providers/admin.service';
import { LoginAdminDto } from './dtos/admin.loginAdminDto';
import { GetAttorneyDto } from './dtos/get-attorney-dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}
  @Post('/signup')
  async createAdmin(@Body() createAdminDto: CreateAdminDto) {
    //Call the service
    return this.adminService.createAdmin(createAdminDto);
  }

  @Post('/signin')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginAdminDto: LoginAdminDto) {
    //Call the service
    return this.adminService.loginAdmin(loginAdminDto);
  }

  @Post('/approval/:id')
  @HttpCode(HttpStatus.OK)
  async approveAttorney(
    @Param('id', ParseIntPipe) attorneyId: GetAttorneyDto,
    @Headers('Authorization') authorization: string,
    @Body('message') approvalMessage: string,
  ) {
    const token = authorization.split(' ')[1];
    return this.adminService.approveAttorney(
      attorneyId,
      approvalMessage,
      token,
    );
  }

  @Post('/deny/:id')
  @HttpCode(HttpStatus.OK)
  async denyAttorney(
    @Param('id', ParseIntPipe) attorneyId: GetAttorneyDto,
    @Body('message') rejectionMessage: string,
    @Headers('Authorization') authorization: string,
  ) {
    const token = authorization.split(' ')[1];
    return this.adminService.denyAttorney(attorneyId, rejectionMessage, token);
  }

  @Post('/deactivate/:id')
  @HttpCode(HttpStatus.OK)
  async DeactivateAttorney(
    @Param('id', ParseIntPipe) attorneyId: GetAttorneyDto,
    @Body('message') rejectionMessage: string,
    @Headers('Authorization') authorization: string,
  ) {
    const token = authorization.split(' ')[1];
    return this.adminService.deactivateAttorney(
      attorneyId,
      rejectionMessage,
      token,
    );
  }

  @Post('/suspend/:id')
  @HttpCode(HttpStatus.OK)
  async SuspendAttorney(
    @Param('id', ParseIntPipe) attorneyId: GetAttorneyDto,
    @Body('message') rejectionMessage: string,
    @Headers('Authorization') authorization: string,
  ) {
    const token = authorization.split(' ')[1];
    return this.adminService.suspendAttorney(
      attorneyId,
      rejectionMessage,
      token,
    );
  }
}
