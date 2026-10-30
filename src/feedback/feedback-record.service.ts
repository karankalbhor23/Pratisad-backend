import { ConflictException, Injectable } from '@nestjs/common';
import { FeedbackSource } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export type RecordFeedbackInput = {
  businessId: string;
  submissionId?: string;
  rating: number;
  keywords: string[];
  comment?: string;
  source: FeedbackSource;
};

export function submissionFingerprint(input: RecordFeedbackInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        rating: input.rating,
        keywords: input.keywords,
        comment: input.comment?.trim() || null,
        source: input.source,
      }),
    )
    .digest('hex');
}

@Injectable()
export class FeedbackRecordService {
  constructor(private readonly prisma: PrismaService) {}

  async recordSubmission(input: RecordFeedbackInput): Promise<{ id: string }> {
    const comment = input.comment?.trim() || null;
    const isPrivate = input.rating <= 3;
    const fingerprint = submissionFingerprint(input);
    const data = {
      businessId: input.businessId,
      clientSubmissionId: input.submissionId,
      submissionFingerprint: fingerprint,
      rating: input.rating,
      keywords: input.keywords,
      comment,
      isPrivate,
      source: input.source,
    };
    const row = input.submissionId
      ? await this.prisma.feedbackSubmission.upsert({
          where: {
            businessId_clientSubmissionId: {
              businessId: input.businessId,
              clientSubmissionId: input.submissionId,
            },
          },
          create: data,
          update: {},
          select: { id: true, submissionFingerprint: true },
        })
      : await this.prisma.feedbackSubmission.create({
          data,
          select: { id: true, submissionFingerprint: true },
        });
    if (
      input.submissionId &&
      row.submissionFingerprint !== fingerprint
    ) {
      throw new ConflictException(
        'This submission key was already used for different feedback.',
      );
    }
    return { id: row.id };
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
