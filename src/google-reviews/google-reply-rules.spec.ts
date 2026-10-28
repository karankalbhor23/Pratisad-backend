import { resolveReplyAction, mapGoogleStarRating } from './google-reply-rules';

describe('google-reply-rules', () => {
  describe('resolveReplyAction', () => {
    it('skips when reply exists on Google', () => {
      expect(
        resolveReplyAction({
          starRating: 5,
          autoReplyEnabled: true,
          hasExistingReply: true,
        }),
      ).toBe('skip_has_reply');
    });

    it('auto posts for 4-5 stars when enabled', () => {
      expect(
        resolveReplyAction({
          starRating: 4,
          autoReplyEnabled: true,
          hasExistingReply: false,
        }),
      ).toBe('auto_post');
    });

    it('queues approval for low stars', () => {
      expect(
        resolveReplyAction({
          starRating: 2,
          autoReplyEnabled: true,
          hasExistingReply: false,
        }),
      ).toBe('pending_approval');
    });

    it('sync only for high stars when auto disabled', () => {
      expect(
        resolveReplyAction({
          starRating: 5,
          autoReplyEnabled: false,
          hasExistingReply: false,
        }),
      ).toBe('synced_only');
    });
  });

  describe('mapGoogleStarRating', () => {
    it('maps Google enum values', () => {
      expect(mapGoogleStarRating('FIVE')).toBe(5);
      expect(mapGoogleStarRating('ONE')).toBe(1);
    });

    it('returns null for unknown', () => {
      expect(mapGoogleStarRating('INVALID')).toBeNull();
    });
  });
});
