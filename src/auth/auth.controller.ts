import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ClerkAuthedRequest } from './authed-request.types';
import { ClerkAuthGuard } from './clerk-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClerkAuthGuard)
  me(@Req() request: ClerkAuthedRequest) {
    return this.authService.resolveMe(
      request.clerkEmail ?? '',
      request.clerkUserId,
    );
  }
}
