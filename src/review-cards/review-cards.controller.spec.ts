import { HttpException } from '@nestjs/common';
import type { Request } from 'express';
import { ReviewCardsController } from './review-cards.controller';
import { checkResolveRateLimit } from './resolve-rate-limit';

jest.mock('./resolve-rate-limit', () => ({
  checkResolveRateLimit: jest.fn(),
}));

describe('ReviewCardsController client IP handling', () => {
  const limiter = checkResolveRateLimit as jest.MockedFunction<typeof checkResolveRateLimit>;
  const reviewCards = { resolveToken: jest.fn() };
  const controller = new ReviewCardsController(reviewCards as never);

  beforeEach(() => jest.resetAllMocks());

  it('uses Express normalized request.ip instead of a forged X-Forwarded-For value', () => {
    limiter.mockReturnValue(true);
    reviewCards.resolveToken.mockReturnValue({ status: 'not_found' });

    controller.resolve('token', {
      ip: '203.0.113.8',
      headers: { 'x-forwarded-for': '198.51.100.99' },
    } as unknown as Request);

    expect(limiter).toHaveBeenCalledWith('203.0.113.8');
  });

  it('rejects based on the normalized proxy-derived IP when its quota is exhausted', () => {
    limiter.mockReturnValue(false);

    expect(() =>
      controller.resolve('token', {
        ip: '203.0.113.8',
        headers: { 'x-forwarded-for': '198.51.100.99' },
      } as unknown as Request),
    ).toThrow(HttpException);
    expect(limiter).toHaveBeenCalledWith('203.0.113.8');
  });
});
