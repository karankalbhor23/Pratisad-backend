import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module';
import { IpThrottleGuard } from '../common/ip-throttle.guard';
import { FeedbackModule } from '../feedback/feedback.module';
import { ReviewDraftsController } from './review-drafts.controller';
import { ReviewDraftsService } from './review-drafts.service';

@Module({
  imports: [BusinessModule, FeedbackModule],
  controllers: [ReviewDraftsController],
  providers: [ReviewDraftsService, IpThrottleGuard],
})
export class ReviewDraftsModule {}
