import {
  generateReviewCardToken,
  isValidReviewCardToken,
  normalizeReviewCardToken,
} from './review-card-token.util';

describe('review-card-token.util', () => {
  it('normalizes and validates tokens', () => {
    const token = generateReviewCardToken();
    expect(isValidReviewCardToken(token)).toBe(true);
    expect(normalizeReviewCardToken(` ${token.toUpperCase()} `)).toBe(token);
  });
});
