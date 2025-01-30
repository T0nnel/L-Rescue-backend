/* eslint-disable prettier/prettier */
import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { CognitoModule } from "../cognito/cognito.module";
import { AuthService } from "./auth.service";

@Module({
    controllers:[AuthController],
    imports:[CognitoModule],
    providers:[AuthService]
})
export class AuthModule {}