import { BadRequestException, Injectable } from '@nestjs/common';
import { FeedbackSource } from '@prisma/client';
import { BusinessService } from '../business/business.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackRecordService } from './feedback-record.service';
import {
  assertKeywordsForRating,
  resolveActiveBusinessForFeedback,
} from './customer-feedback.validation';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly businessService: BusinessService,
    private readonly feedbackRecord: FeedbackRecordService,
  ) {}

  async submitPrivate(input: CreateFeedbackDto): Promise<{ id: string }> {
    if (input.rating > 3) {
      throw new BadRequestException(
        'Ratings of 4 or 5 should use review draft flow.',
      );
    }

    const business = await resolveActiveBusinessForFeedback(
      this.businessService,
      input.businessSlug,
    );
    const keywords = assertKeywordsForRating(
      business,
      input.rating,
      input.keywords,
    );

    return this.feedbackRecord.recordSubmission({
      businessId: business.id,
      submissionId: input.submissionId,
      rating: input.rating,
      keywords,
      comment: input.comment,
      source: FeedbackSource.private_submit,
    });
  }
}
