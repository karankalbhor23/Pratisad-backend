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
      this.logger.warn(
        `Google OAuth callback missing params: googleError=${error ?? 'none'} hasCode=${Boolean(code)} hasState=${Boolean(state)}`,
      );
      res.redirect(`${base}?error=connect_failed`);
      return;
    }

    try {
      await this.googleReviews.completeOAuth(code, state);
      this.logger.log('Google OAuth callback completed successfully');
      res.redirect(`${base}?connected=1`);
    } catch (err) {
      const reason = classifyOAuthCallbackError(err);
      this.logger.warn(
        `Google OAuth callback failed (${reason}): ${err instanceof Error ? err.message : String(err)}`,
      );
      res.redirect(`${base}?error=${reason}`);
    }
  }
}
