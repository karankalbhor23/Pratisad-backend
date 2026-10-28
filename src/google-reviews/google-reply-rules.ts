export type GoogleReplyAction =
  | 'skip_has_reply'
  | 'auto_post'
  | 'pending_approval'
  | 'synced_only';

export function resolveReplyAction(input: {
  starRating: number;
  autoReplyEnabled: boolean;
  hasExistingReply: boolean;
}): GoogleReplyAction {
  if (input.hasExistingReply) return 'skip_has_reply';
  if (input.starRating >= 4 && input.autoReplyEnabled) return 'auto_post';
  if (input.starRating <= 3) return 'pending_approval';
  return 'synced_only';
}

export function mapGoogleStarRating(value: string | undefined): number | null {
  if (!value) return null;
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
    STAR_RATING_UNSPECIFIED: 0,
  };
  const rating = map[value];
  return rating && rating >= 1 && rating <= 5 ? rating : null;
}
