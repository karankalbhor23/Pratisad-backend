import { BadRequestException, NotFoundException } from '@nestjs/common';
import { bandForRating } from '../business/experience-keywords.constants';
import {
  allowedKeywordSet,
  resolveKeywordOptions,
  validateSubmittedKeywords,
} from '../business/keyword-options.util';
import { BusinessService } from '../business/business.service';

export type CustomerFeedbackInput = {
  businessSlug: string;
  rating: number;
  keywords: string[];
  comment?: string;
};

export async function resolveActiveBusinessForFeedback(
  businessService: BusinessService,
  businessSlug: string,
) {
  const business = await businessService.findBySlug(businessSlug, true);
  if (!business) throw new NotFoundException('Business not found');
  return business;
}

export function assertKeywordsForRating(
  business: {
    keywordsRatingLow: string[];
    keywordsRatingHigh: string[];
  },
  rating: number,
  keywords: string[],
): string[] {
  const band = bandForRating(rating);
  const allowed = allowedKeywordSet(business, band);
  if (
    !validateSubmittedKeywords(keywords, allowed) ||
    new Set(keywords.map((keyword) => keyword.trim().toLowerCase())).size !==
      keywords.length
  ) {
    throw new BadRequestException(
      'Invalid experience keywords for this rating.',
    );
  }
  const canonical = new Map(
    resolveKeywordOptions(business, band).map((keyword) => [
      keyword.toLowerCase(),
      keyword,
    ]),
  );
  return keywords.map((keyword) =>
    canonical.get(keyword.trim().toLowerCase())!,
  );
}
