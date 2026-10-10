import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module';
import { ReviewDraftThrottleGuard } from './review-draft-throttle.guard';
import { ReviewDraftsController } from './review-drafts.controller';
import { ReviewDraftsService } from './review-drafts.service';

@Module({
  imports: [BusinessModule],
  controllers: [ReviewDraftsController],
  providers: [ReviewDraftsService, ReviewDraftThrottleGuard],
})
export class ReviewDraftsModule {}
