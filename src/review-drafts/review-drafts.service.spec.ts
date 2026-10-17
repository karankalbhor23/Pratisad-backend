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
  const feedbackRecord = {
    recordAiUsage: jest.fn().mockResolvedValue(undefined),
    recordSubmission: jest.fn().mockResolvedValue({ id: 'feedback-id' }),
  };
  const service = new ReviewDraftsService(
    businessService as unknown as BusinessService,
    config as unknown as ConfigService,
    feedbackRecord as never,
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
      id: 'business-id',
      name: 'Test Business',
      localContext: 'A neighborhood cafe',
      keywordsRatingLow: [],
      keywordsRatingHigh: [],
    });
    config.get = jest.fn((key: string) =>
      key === 'GEMINI_API_KEY' ? 'test-key' : undefined,
    );
  });

  it('returns a trimmed provider draft without exposing input', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: ' Draft text. ' }] } }],
        }),
    });
    await expect(service.create(input)).resolves.toEqual({
      draft: 'Draft text.',
    });
    expect(feedbackRecord.recordAiUsage).toHaveBeenCalled();
    expect(feedbackRecord.recordSubmission).toHaveBeenCalled();
    expect(businessService.findBySlug).toHaveBeenCalledWith(
      'test-business',
      true,
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-goog-api-key': 'test-key' }),
        body: expect.any(String),
      }),
    );
    const requestInit = (global.fetch as jest.Mock).mock.calls[0][1] as {
      body: string;
    };
    const body = JSON.parse(requestInit.body) as {
      systemInstruction: { parts: Array<{ text: string }> };
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
      generationConfig: {
        maxOutputTokens: number;
      };
    };
    expect(body.generationConfig.maxOutputTokens).toBe(1024);
    expect(body.generationConfig).not.toHaveProperty('thinkingConfig');
    expect(body.systemInstruction.parts[0].text).toContain(
      'Category, Setting, Vocabulary',
    );
    expect(body.systemInstruction.parts[0].text).toContain(
      'prefer omitting locality',
    );
    expect(body.contents).toHaveLength(1);
    expect(body.contents[0].role).toBe('user');
    expect(body.contents[0].parts[0].text).toContain('Business: Test Business');
    expect(body.contents[0].parts[0].text).toContain(
      'Business context: A neighborhood cafe',
    );
    expect(body.contents[0].parts[0].text).toContain('Rating: 2/5 (negative)');
    expect(body.contents[0].parts[0].text).toContain(
      'Experience themes: Poor experience',
    );
    expect(body.contents[0].parts[0].text).toContain(
      'Customer comment: Too slow.',
    );
    expect(body.contents[0].parts[0].text).toContain('Draft note:');
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
      json: () => Promise.resolve({ candidates: [] }),
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
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: content }] } }],
          }),
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

  it('uses non-thought response parts when the provider returns thinking output', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  { thought: true, text: 'Internal reasoning summary.' },
                  { text: 'Great food and friendly staff.' },
                ],
              },
            },
          ],
        }),
    });
    await expect(service.create(input)).resolves.toEqual({
      draft: 'Great food and friendly staff.',
    });
  });

  it('falls back when the preferred model is temporarily unavailable', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'Fallback draft.' }] } }],
          }),
      });
    await expect(service.create(input)).resolves.toEqual({
      draft: 'Fallback draft.',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
      expect.any(Object),
    );
    expect(feedbackRecord.recordAiUsage).toHaveBeenCalledWith(
      'business-id',
      'gemini-3.1-flash-lite',
      true,
    );
  });

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

  it('maps sustained provider unavailability safely', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(service.create(input)).rejects.toMatchObject({
      status: 503,
    } as ServiceUnavailableException);
    expect(global.fetch).toHaveBeenCalledTimes(3);
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
