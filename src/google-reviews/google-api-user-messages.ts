import { GoogleApiError } from './google-business-api.client';

/** User-safe hint when Google Business Profile APIs reject the call. */
export function userMessageForGoogleApiError(error: unknown): string {
  if (!(error instanceof GoogleApiError)) {
    return 'Could not reach Google Business Profile. Try again later.';
  }
  if (error.status === 403 || error.status === 401) {
    return (
      'Google blocked Business Profile API access for this project. Enable the Google Business Profile API ' +
      '(mybusiness.googleapis.com), Account Management, and Business Information APIs, then request GBP access ' +
      'if your quota is 0: https://developers.google.com/my-business/content/prereqs#request-access'
    );
  }
  if (error.status === 404) {
    return (
      'Google could not find reviews for this location. Save your location again in the portal (Load locations → Save), then sync.'
    );
  }
  if (error.status === 429) {
    return 'Google API rate limit reached. Wait a few minutes and try Load locations again.';
  }
  return 'Google Business Profile returned an error. Check API access in Google Cloud Console.';
}

export const GBP_ACCESS_REQUEST_URL =
  'https://developers.google.com/my-business/content/prereqs#request-access';
