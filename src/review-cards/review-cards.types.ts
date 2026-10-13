export type ReviewCardResolveOutcome =
  | 'redirect'
  | 'unassigned'
  | 'revoked'
  | 'business_inactive'
  | 'not_found';

export type ReviewCardResolveDto =
  | { outcome: 'redirect'; slug: string }
  | { outcome: Exclude<ReviewCardResolveOutcome, 'redirect'> };
