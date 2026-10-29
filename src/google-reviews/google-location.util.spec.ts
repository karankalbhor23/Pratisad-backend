import { reviewsApiLocationName } from './google-location.util';

describe('reviewsApiLocationName', () => {
  it('prefixes account when location is relative', () => {
    expect(
      reviewsApiLocationName(
        'accounts/111',
        'locations/222',
      ),
    ).toBe('accounts/111/locations/222');
  });

  it('keeps full resource name unchanged', () => {
    expect(
      reviewsApiLocationName(
        'accounts/111',
        'accounts/111/locations/222',
      ),
    ).toBe('accounts/111/locations/222');
  });
});
