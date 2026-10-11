import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module';
import { IpThrottleGuard } from '../common/ip-throttle.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackRecordService } from './feedback-record.service';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [PrismaModule, BusinessModule],
  controllers: [FeedbackController],
  providers: [FeedbackService, FeedbackRecordService, IpThrottleGuard],
  exports: [FeedbackRecordService],
})
export class FeedbackModule {}
