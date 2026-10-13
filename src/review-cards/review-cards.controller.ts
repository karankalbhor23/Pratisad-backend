import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { checkResolveRateLimit } from './resolve-rate-limit';
import { ReviewCardsService } from './review-cards.service';

@Controller('review-cards')
export class ReviewCardsController {
  constructor(private readonly reviewCards: ReviewCardsService) {}

  @Get(':token/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(@Param('token') token: string, @Req() req: Request) {
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ?? req.ip;
    if (!checkResolveRateLimit(ip ?? 'unknown')) {
      throw new HttpException(
        'Too many requests. Try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return this.reviewCards.resolveToken(token);
  }
}
