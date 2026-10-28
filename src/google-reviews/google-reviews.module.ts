import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleBusinessApiClient } from './google-business-api.client';
import { GoogleOAuthCallbackController } from './google-oauth-callback.controller';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleReplyGeneratorService } from './google-reply-generator.service';
import { GoogleReviewsCronService } from './google-reviews-cron.service';
import { GoogleReviewsPortalController } from './google-reviews-portal.controller';
import { GoogleReviewsAdminController } from './google-reviews-admin.controller';
import { GoogleReviewsRateLimitService } from './google-reviews-rate-limit.service';
import { GoogleReviewsService } from './google-reviews.service';
import { GoogleTokenCipher } from './google-token.cipher';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    GoogleReviewsPortalController,
    GoogleOAuthCallbackController,
    GoogleReviewsAdminController,
  ],
  providers: [
    GoogleReviewsService,
    GoogleOAuthService,
    GoogleTokenCipher,
    GoogleBusinessApiClient,
    GoogleReplyGeneratorService,
    GoogleReviewsRateLimitService,
    GoogleReviewsCronService,
  ],
  exports: [GoogleReviewsService],
})
export class GoogleReviewsModule {}
