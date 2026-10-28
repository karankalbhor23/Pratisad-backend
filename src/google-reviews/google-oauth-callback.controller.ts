import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { classifyOAuthCallbackError } from './google-oauth-callback.errors';
import { GoogleReviewsService } from './google-reviews.service';

@Controller('integrations/google')
export class GoogleOAuthCallbackController {
  private readonly logger = new Logger(GoogleOAuthCallbackController.name);

  constructor(
    private readonly googleReviews: GoogleReviewsService,
    private readonly config: ConfigService,
  ) {}

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const webOrigin =
      this.config.get<string>('WEB_APP_ORIGIN')?.replace(/\/+$/, '') ??
      'http://localhost:3000';
    const base = `${webOrigin}/portal/google-reviews`;

    if (error || !code || !state) {
      res.redirect(`${base}?error=connect_failed`);
      return;
    }

    try {
      await this.googleReviews.completeOAuth(code, state);
      res.redirect(`${base}?connected=1`);
    } catch (error) {
      const code = classifyOAuthCallbackError(error);
      this.logger.warn(
        `Google OAuth callback failed (${code}): ${error instanceof Error ? error.message : String(error)}`,
      );
      res.redirect(`${base}?error=${code}`);
    }
  }
}
