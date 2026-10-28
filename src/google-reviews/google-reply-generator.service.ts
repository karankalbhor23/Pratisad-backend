import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const GEMINI_FALLBACK_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
];
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 512;
const MAX_REPLY_CHARS = 3500;

const REPLY_SYSTEM_PROMPT = `You write short, professional Google Business Profile owner replies to customer reviews on behalf of a local business.

Rules:
- Reply in the same language as the customer's review text. If unclear, use English.
- Be warm and human; thank the reviewer by name when a display name is provided (not "Anonymous").
- Reference one specific point from their review when possible; do not invent details.
- Keep the reply concise (about 2–4 sentences). No emojis. No em dash.
- Never offer discounts, gifts, or incentives for reviews. Never ask them to change their rating.
- For low ratings (1–3 stars): apologize briefly, acknowledge the concern, invite them to contact the business offline—no arguments or blame.
- For high ratings (4–5 stars): express genuine thanks; do not sound like marketing copy.
- Return only the reply text—no quotes, labels, or explanation.`;

function resolveGeminiModels(preferredModel: string): string[] {
  const models = [preferredModel];
  for (const fallback of GEMINI_FALLBACK_MODELS) {
    if (!models.includes(fallback)) models.push(fallback);
  }
  return models;
}

function extractGeminiText(data: unknown): string | null {
  const candidate = (
    data as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: unknown; thought?: boolean }> };
      }>;
    }
  )?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (!parts?.length) return null;
  const responseText = parts
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('')
    .trim();
  return responseText || null;
}

export type GenerateReplyInput = {
  businessName: string;
  localContext: string | null;
  starRating: number;
  reviewComment: string | null;
  reviewerDisplayName: string | null;
};

@Injectable()
export class GoogleReplyGeneratorService {
  constructor(private readonly config: ConfigService) {}

  async generateReply(input: GenerateReplyInput): Promise<string> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    const preferredModel =
      this.config.get<string>('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Reply generation is temporarily unavailable.',
      );
    }

    const userPrompt = [
      `Business name: ${input.businessName}`,
      `Business context (tone only): ${input.localContext?.trim() || '(none)'}`,
      `Star rating: ${input.starRating}/5`,
      `Reviewer name: ${input.reviewerDisplayName?.trim() || 'Anonymous'}`,
      `Review text: ${input.reviewComment?.trim() || '(no comment)'}`,
    ].join('\n');

    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: REPLY_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
    });

    let sawRateLimit = false;
    let sawUnavailable = false;

    for (const model of resolveGeminiModels(preferredModel)) {
      let response: Response;
      try {
        response = await fetch(
          `${GEMINI_API_BASE}/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'x-goog-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: requestBody,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          },
        );
      } catch (error) {
        if (
          (error instanceof DOMException &&
            (error.name === 'TimeoutError' || error.name === 'AbortError')) ||
          (error as { name?: string })?.name === 'AbortError'
        ) {
          throw new GatewayTimeoutException('Reply generation timed out.');
        }
        throw new BadGatewayException(
          'Reply generation is temporarily unavailable.',
        );
      }

      if (response.status === 429) {
        sawRateLimit = true;
        continue;
      }
      if (response.status === 503) {
        sawUnavailable = true;
        continue;
      }
      if (!response.ok) continue;

      const data = await response.json();
      const text = extractGeminiText(data);
      if (!text) continue;
      return text.slice(0, MAX_REPLY_CHARS);
    }

    if (sawRateLimit) {
      throw new HttpException(
        'Reply generation is busy. Please try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (sawUnavailable) {
      throw new ServiceUnavailableException(
        'Reply generation is temporarily unavailable.',
      );
    }
    throw new BadGatewayException(
      'Reply generation is temporarily unavailable.',
    );
  }
}
