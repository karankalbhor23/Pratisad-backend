import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessService } from '../business/business.service';
import { ReviewDraftsService } from './review-drafts.service';

describe('ReviewDraftsService', () => {
  const businessService = { findBySlug: jest.fn() };
  const config = { get: jest.fn() };
  const service = new ReviewDraftsService(
    businessService as unknown as BusinessService,
    config as unknown as ConfigService,
  );
  const input = {
    businessSlug: 'test-business',
    rating: 2,
    keywords: ['Poor experience'],
    comment: '  Too slow.  ',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    businessService.findBySlug = jest.fn().mockResolvedValue({
      name: 'Test Business',
      localContext: 'A neighborhood cafe',
      keywordsRatingLow: [],
      keywordsRatingHigh: [],
    });
    config.get = jest.fn((key: string) =>
      key === 'OPENROUTER_API_KEY' ? 'test-key' : 'test-model',
    );
  });

  it('returns a trimmed provider draft without exposing input', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: ' Draft text. ' } }],
        }),
    });
    await expect(service.create(input)).resolves.toEqual({
      draft: 'Draft text.',
    });
    expect(businessService.findBySlug).toHaveBeenCalledWith(
      'test-business',
      true,
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.any(String),
      }),
    );
    const requestInit = (global.fetch as jest.Mock).mock.calls[0][1] as {
      body: string;
    };
    const body = JSON.parse(requestInit.body) as {
      temperature: number;
      max_tokens: number;
      reasoning: { enabled: boolean };
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(320);
    expect(body.reasoning).toEqual({ enabled: false });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual(
      expect.objectContaining({ role: 'system', content: expect.any(String) }),
    );
    expect(body.messages[0].content).toContain('Category, Setting, Vocabulary');
    expect(body.messages[0].content).toContain('prefer omitting locality');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toContain('Business: Test Business');
    expect(body.messages[1].content).toContain(
      'Business context: A neighborhood cafe',
    );
    expect(body.messages[1].content).toContain('Rating: 2/5 (negative)');
    expect(body.messages[1].content).toContain(
      'Experience themes: Poor experience',
    );
    expect(body.messages[1].content).toContain('Customer comment: Too slow.');
    expect(body.messages[1].content).toContain('Draft note:');
  });

  it('rejects keywords that are not allowed for the rating band', async () => {
    await expect(
      service.create({
        ...input,
        rating: 5,
        keywords: ['Poor experience'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects missing businesses and missing provider configuration', async () => {
    businessService.findBySlug = jest.fn().mockResolvedValue(null);
    await expect(service.create(input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    businessService.findBySlug = jest.fn().mockResolvedValue({
      name: 'Test Business',
      localContext: null,
      keywordsRatingLow: [],
      keywordsRatingHigh: [],
    });
    config.get = jest.fn().mockReturnValue(undefined);
    await expect(service.create(input)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects malformed provider output', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ choices: [] }),
    });
    await expect(service.create(input)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('rejects empty and whitespace-only drafts', async () => {
    for (const content of ['', '   ']) {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ choices: [{ message: { content } }] }),
      });
      await expect(service.create(input)).rejects.toMatchObject({
        status: 502,
      });
    }
  });

  it.each([401, 403, 500])(
    'maps provider status %i to a safe gateway error',
    async (status) => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status });
      await expect(service.create(input)).rejects.toMatchObject({
        status: 502,
      });
    },
  );

  it('maps provider rate limits, network failures, and invalid JSON safely', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(service.create(input)).rejects.toMatchObject({
      status: 429,
    } as HttpException);
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    await expect(service.create(input)).rejects.toMatchObject({ status: 502 });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('json')),
    });
    await expect(service.create(input)).rejects.toMatchObject({ status: 502 });
  });

  it('maps provider timeouts safely', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new DOMException('', 'TimeoutError'));
    await expect(service.create(input)).rejects.toMatchObject({
      status: 504,
    } as GatewayTimeoutException);
  });
});
