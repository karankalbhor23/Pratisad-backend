/**
 * Google Business Information often returns location.name as `locations/{id}`.
 * My Business v4 reviews API requires `accounts/{accountId}/locations/{locationId}`.
 */
export function reviewsApiLocationName(
  accountName: string | null | undefined,
  storedLocationName: string,
): string {
  const location = storedLocationName.trim();
  if (!location) return location;

  if (location.startsWith('accounts/') && location.includes('/locations/')) {
    return location;
  }

  const account = accountName?.trim();
  if (account && location.startsWith('locations/')) {
    return `${account.replace(/\/$/, '')}/${location}`;
  }

  return location;
}
