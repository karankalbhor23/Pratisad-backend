import { Controller, Get, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PlatformAdminGuard } from './platform-admin.guard';

type AuthedRequest = Request & { platformAdminEmail?: string };

@Controller('auth')
export class AuthController {
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  me(@Req() request: AuthedRequest): { email: string; isPlatformAdmin: true } {
    return {
      email: request.platformAdminEmail ?? '',
      isPlatformAdmin: true,
    };
  }
}
