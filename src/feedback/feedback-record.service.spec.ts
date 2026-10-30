import { ConflictException } from '@nestjs/common';
import { FeedbackSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  FeedbackRecordService,
  submissionFingerprint,
} from './feedback-record.service';

describe('FeedbackRecordService idempotency', () => {
  const prisma = {
    feedbackSubmission: { create: jest.fn(), upsert: jest.fn() },
  };
  const service = new FeedbackRecordService(prisma as unknown as PrismaService);
  const base = {
    businessId: 'business-a',
    submissionId: '11111111-1111-4111-8111-111111111111',
    rating: 2,
    keywords: ['Poor experience'],
    comment: 'Slow service',
    source: FeedbackSource.private_submit,
  };

  beforeEach(() => jest.resetAllMocks());

  it('returns the same record for repeated requests in one business', async () => {
    prisma.feedbackSubmission.upsert.mockResolvedValue({
      id: 'feedback-a',
      submissionFingerprint: submissionFingerprint(base),
    });
    await expect(service.recordSubmission(base)).resolves.toEqual({ id: 'feedback-a' });
    await expect(service.recordSubmission(base)).resolves.toEqual({ id: 'feedback-a' });
    expect(prisma.feedbackSubmission.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.feedbackSubmission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId_clientSubmissionId: {
            businessId: 'business-a',
            clientSubmissionId: base.submissionId,
          },
        },
      }),
    );
  });

  it('allows the same key to be used by another business', async () => {
    prisma.feedbackSubmission.upsert
      .mockResolvedValueOnce({ id: 'feedback-a', submissionFingerprint: submissionFingerprint(base) })
      .mockResolvedValueOnce({
        id: 'feedback-b',
        submissionFingerprint: submissionFingerprint({ ...base, businessId: 'business-b' }),
      });
    await expect(service.recordSubmission(base)).resolves.toEqual({ id: 'feedback-a' });
    await expect(
      service.recordSubmission({ ...base, businessId: 'business-b' }),
    ).resolves.toEqual({ id: 'feedback-b' });
  });

  it('rejects a conflicting payload for the same business and key', async () => {
    prisma.feedbackSubmission.upsert.mockResolvedValue({
      id: 'feedback-a',
      submissionFingerprint: 'different-fingerprint',
    });
    await expect(service.recordSubmission(base)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('uses an atomic upsert path for concurrent retries', async () => {
    prisma.feedbackSubmission.upsert.mockResolvedValue({
      id: 'feedback-a',
      submissionFingerprint: submissionFingerprint(base),
    });
    await Promise.all([
      service.recordSubmission(base),
      service.recordSubmission(base),
    ]);
    expect(prisma.feedbackSubmission.upsert).toHaveBeenCalledTimes(2);
  });
});
