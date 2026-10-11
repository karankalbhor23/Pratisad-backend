import { BadRequestException } from '@nestjs/common';
import { BusinessService } from '../business/business.service';
import { FeedbackRecordService } from './feedback-record.service';
import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
  const businessService = {
    findBySlug: jest.fn(),
  };
  const feedbackRecord = {
    recordSubmission: jest.fn(),
  };
  const service = new FeedbackService(
    businessService as unknown as BusinessService,
    feedbackRecord as unknown as FeedbackRecordService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    businessService.findBySlug = jest.fn().mockResolvedValue({
      id: 'biz-1',
      keywordsRatingLow: ['Poor experience'],
      keywordsRatingHigh: [],
    });
    feedbackRecord.recordSubmission = jest
      .fn()
      .mockResolvedValue({ id: 'fb-1' });
  });

  it('rejects ratings above 3', async () => {
    await expect(
      service.submitPrivate({
        businessSlug: 'test',
        rating: 5,
        keywords: ['Good quality'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores private feedback for low ratings', async () => {
    await expect(
      service.submitPrivate({
        businessSlug: 'test',
        rating: 2,
        keywords: ['Poor experience'],
        comment: 'Slow',
      }),
    ).resolves.toEqual({ id: 'fb-1' });
    expect(feedbackRecord.recordSubmission).toHaveBeenCalled();
  });
});
