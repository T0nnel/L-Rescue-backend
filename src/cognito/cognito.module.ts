/* eslint-disable prettier/prettier */
import {  Module } from '@nestjs/common';

import { CognitoService } from './cognito.service';

@Module({
  providers: [CognitoService,
    {
      provide: 'COGNITO_CONFIG',
      useFactory: () => ({
          userPoolId: process.env.COGNITO_USER_POOL_ID,
          clientId: process.env.COGNITO_CLIENT_ID,
          clientSecret: process.env.COGNITO_CLIENT_SECRET,
          awsRegion: process.env.REGION    
      })
  }
  ],
  exports: [CognitoService],
})
export class CognitoModule {}
