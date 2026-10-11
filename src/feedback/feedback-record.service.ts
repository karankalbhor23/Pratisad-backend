import { Injectable } from '@nestjs/common';
import { FeedbackSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type RecordFeedbackInput = {
  businessId: string;
  rating: number;
  keywords: string[];
  comment?: string;
  source: FeedbackSource;
};

@Injectable()
export class FeedbackRecordService {
  constructor(private readonly prisma: PrismaService) {}

  async recordSubmission(input: RecordFeedbackInput): Promise<{ id: string }> {
    const comment = input.comment?.trim() || null;
    const isPrivate = input.rating <= 3;
    const row = await this.prisma.feedbackSubmission.create({
      data: {
        businessId: input.businessId,
        rating: input.rating,
        keywords: input.keywords,
        comment,
        isPrivate,
        source: input.source,
      },
      select: { id: true },
    });
    return row;
  }

  async recordAiUsage(
    businessId: string,
    model: string,
    success = true,
  ): Promise<void> {
    await this.prisma.aiUsageEvent.create({
      data: { businessId, model, success },
    });
  }
}
