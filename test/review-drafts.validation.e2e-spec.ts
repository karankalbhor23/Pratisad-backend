import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ReviewDraftThrottleGuard } from '../src/review-drafts/review-draft-throttle.guard';
import { ReviewDraftsController } from '../src/review-drafts/review-drafts.controller';
import { ReviewDraftsService } from '../src/review-drafts/review-drafts.service';

describe('Review drafts validation (e2e)', () => {
  let app: INestApplication<App>;
  const service = { create: jest.fn() };
  const valid = {
    businessSlug: 'test-business',
    rating: 3,
    keywords: ['As expected'],
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReviewDraftsController],
      providers: [
        ReviewDraftThrottleGuard,
        { provide: ReviewDraftsService, useValue: service },
      ],
    })
      .overrideGuard(ReviewDraftThrottleGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => jest.resetAllMocks());
  afterAll(async () => app.close());

  it.each([
    [{ ...valid, businessSlug: undefined }],
    [{ ...valid, businessSlug: 'Bad Slug' }],
    [{ ...valid, rating: undefined }],
    [{ ...valid, rating: 0 }],
    [{ ...valid, rating: 6 }],
    [{ ...valid, rating: 2.5 }],
    [{ ...valid, rating: 'bad' }],
    [{ ...valid, keywords: undefined }],
    [{ ...valid, keywords: [] }],
    [{ ...valid, keywords: 'bad' }],
    [{ ...valid, keywords: Array(11).fill('ok') }],
    [{ ...valid, keywords: ['x'.repeat(61)] }],
    [{ ...valid, comment: 'x'.repeat(1001) }],
    [{ ...valid, unexpected: true }],
  ])('rejects invalid input without calling the service', async (body) => {
    await request(app.getHttpServer())
      .post('/review-drafts')
      .send(body)
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('accepts the comment boundary and returns only the draft', async () => {
    service.create.mockResolvedValue({ draft: 'Accurate draft.' });
    const response = await request(app.getHttpServer())
      .post('/review-drafts')
      .send({ ...valid, comment: 'x'.repeat(1000) })
      .expect(200);
    expect(response.body).toEqual({ draft: 'Accurate draft.' });
    expect(service.create).toHaveBeenCalledTimes(1);
  });
});
