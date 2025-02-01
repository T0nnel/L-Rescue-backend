import { Controller, Post, Body, Res } from '@nestjs/common';
import { CreateAdminDto } from './dtos/admin.createAdminDto';
import { AdminService } from './providers/admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}
  @Post('/signup')
  async createAdmin(@Body() createAdminDto: CreateAdminDto) {
    //Call the service
    return this.adminService.createAdmin(createAdminDto);
  }
}
