/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { CognitoService } from "../cognito/cognito.service";
import { CreateAuthDto } from "../auth/dto/create-auth.dto";
import { UpdateUserProfileDto } from "./dto/update-auth.dto";
import { LoginUserDto } from "./dto/login_user.dto";

@Injectable()
export class AuthService{
    constructor(private readonly cognitoService: CognitoService){}

    async registerUser(registerUserDto: CreateAuthDto){
        return this.cognitoService.registerUser(registerUserDto)
    }
    async loginUser(loginUserDto: LoginUserDto) {
      const { username, password } = loginUserDto; 
      return this.cognitoService.loginUser(username, password); 
  }

  
  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: UpdateUserProfileDto) {
    console.log(updateAuthDto);
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
