import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessReviewCardsController } from './business-review-cards.controller';
import { ReviewCardBatchesController } from './review-card-batches.controller';
import { ReviewCardsController } from './review-cards.controller';
import { ReviewCardsService } from './review-cards.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    ReviewCardsController,
    ReviewCardBatchesController,
    BusinessReviewCardsController,
  ],
  providers: [ReviewCardsService],
  exports: [ReviewCardsService],
})
export class ReviewCardsModule {}
