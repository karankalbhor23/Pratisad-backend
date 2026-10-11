export const DEFAULT_KEYWORDS_RATING_LOW = [
  'Could be improved',
  'Long waiting time',
  'Poor experience',
  'As expected',
] as const;

export const DEFAULT_KEYWORDS_RATING_HIGH = [
  'Friendly staff',
  'Helpful service',
  'Quick service',
  'Good quality',
  'Clean environment',
  'Good value',
] as const;

export type RatingBand = 'low' | 'high';

export function bandForRating(rating: number): RatingBand {
  return rating <= 3 ? 'low' : 'high';
}
