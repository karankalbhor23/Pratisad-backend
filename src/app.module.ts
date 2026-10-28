import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { BusinessModule } from './business/business.module';
import { ReviewDraftsModule } from './review-drafts/review-drafts.module';
import { AuthModule } from './auth/auth.module';
import { FeedbackModule } from './feedback/feedback.module';
import { PortalModule } from './portal/portal.module';
import { ClerkWebhooksModule } from './clerk-webhooks/clerk-webhooks.module';
import { ReviewCardsModule } from './review-cards/review-cards.module';
import { GoogleReviewsModule } from './google-reviews/google-reviews.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    BusinessModule,
    FeedbackModule,
    ReviewDraftsModule,
    PortalModule,
    ClerkWebhooksModule,
    ReviewCardsModule,
    GoogleReviewsModule,
  ],
})
export class AppModule {}
