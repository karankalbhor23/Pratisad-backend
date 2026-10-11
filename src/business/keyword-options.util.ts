import {
  DEFAULT_KEYWORDS_RATING_HIGH,
  DEFAULT_KEYWORDS_RATING_LOW,
  type RatingBand,
} from './experience-keywords.constants';

const MAX_KEYWORDS_PER_BAND = 30;
const MAX_KEYWORD_LENGTH = 60;

export function normalizeKeywordList(
  values: string[] | null | undefined,
): string[] {
  if (!values?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > MAX_KEYWORD_LENGTH) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= MAX_KEYWORDS_PER_BAND) break;
  }
  return result;
}

export function resolveKeywordOptions(
  business: {
    keywordsRatingLow: string[];
    keywordsRatingHigh: string[];
  },
  band: RatingBand,
): readonly string[] {
  const custom =
    band === 'low'
      ? normalizeKeywordList(business.keywordsRatingLow)
      : normalizeKeywordList(business.keywordsRatingHigh);
  if (custom.length > 0) return custom;
  return band === 'low'
    ? DEFAULT_KEYWORDS_RATING_LOW
    : DEFAULT_KEYWORDS_RATING_HIGH;
}

/** O(1) membership checks for draft validation. */
export function allowedKeywordSet(
  business: {
    keywordsRatingLow: string[];
    keywordsRatingHigh: string[];
  },
  band: RatingBand,
): Set<string> {
  const options = resolveKeywordOptions(business, band);
  return new Set(options.map((k) => k.toLowerCase()));
}

export function validateSubmittedKeywords(
  keywords: string[],
  allowed: Set<string>,
): boolean {
  if (!keywords.length) return false;
  for (const keyword of keywords) {
    if (!allowed.has(keyword.toLowerCase())) return false;
  }
  return true;
}
