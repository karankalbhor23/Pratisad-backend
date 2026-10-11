import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import type * as Express from 'express';
import { AuthService } from './auth.service';
import { asClerkAuthedRequest } from './authed-request.types';
import { ClerkAuthGuard } from './clerk-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClerkAuthGuard)
  me(@Req() request: Express.Request) {
    const authed = asClerkAuthedRequest(request);
    return this.authService.resolveMe({
      email: authed.clerkEmail,
      username: authed.clerkUsername,
      clerkUserId: authed.clerkUserId,
    });
  }
}
