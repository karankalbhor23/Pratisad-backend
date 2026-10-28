import { Injectable, Logger } from '@nestjs/common';

const ACCOUNT_API = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const LOCATION_API = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const REVIEWS_API = 'https://mybusiness.googleapis.com/v4';

export type GoogleAccountSummary = {
  name: string;
  accountName?: string;
  type?: string;
};

export type GoogleLocationSummary = {
  name: string;
  title?: string;
  storefrontAddress?: { addressLines?: string[] };
};

export type GoogleReviewRecord = {
  name: string;
  starRating?: string;
  comment?: string;
  reviewer?: { displayName?: string; isAnonymous?: boolean };
  createTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
};

@Injectable()
export class GoogleBusinessApiClient {
  private readonly logger = new Logger(GoogleBusinessApiClient.name);

  async listAccounts(accessToken: string): Promise<GoogleAccountSummary[]> {
    const data = await this.getJson<{ accounts?: GoogleAccountSummary[] }>(
      `${ACCOUNT_API}/accounts`,
      accessToken,
    );
    return data.accounts ?? [];
  }

  async listLocations(
    accessToken: string,
    accountName: string,
    pageSize = 100,
  ): Promise<GoogleLocationSummary[]> {
    const parent = accountName;
    const data = await this.getJson<{ locations?: GoogleLocationSummary[] }>(
      `${LOCATION_API}/${parent}/locations?pageSize=${pageSize}&readMask=name,title,storefrontAddress`,
      accessToken,
    );
    return data.locations ?? [];
  }

  async listReviews(
    accessToken: string,
    locationName: string,
    pageToken?: string,
  ): Promise<{ reviews: GoogleReviewRecord[]; nextPageToken?: string }> {
    const query = pageToken
      ? `?pageToken=${encodeURIComponent(pageToken)}`
      : '';
    const data = await this.getJson<{
      reviews?: GoogleReviewRecord[];
      nextPageToken?: string;
    }>(`${REVIEWS_API}/${locationName}/reviews${query}`, accessToken);
    return { reviews: data.reviews ?? [], nextPageToken: data.nextPageToken };
  }

  async getReview(
    accessToken: string,
    reviewName: string,
  ): Promise<GoogleReviewRecord> {
    return this.getJson<GoogleReviewRecord>(
      `${REVIEWS_API}/${reviewName}`,
      accessToken,
    );
  }

  async updateReply(
    accessToken: string,
    reviewName: string,
    comment: string,
  ): Promise<{ comment?: string; updateTime?: string }> {
    const response = await fetch(`${REVIEWS_API}/${reviewName}/reply`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(
        `Google updateReply failed status=${response.status} review=${reviewName}`,
      );
      throw new GoogleApiError(response.status, body.slice(0, 500));
    }
    return (await response.json()) as { comment?: string; updateTime?: string };
  }

  async revokeToken(refreshToken: string, clientId: string, clientSecret: string): Promise<void> {
    try {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // Best-effort revoke.
    }
    void clientId;
    void clientSecret;
  }

  private async getJson<T>(url: string, accessToken: string): Promise<T> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(
        `Google API ${response.status} ${url} body=${body.slice(0, 300)}`,
      );
      throw new GoogleApiError(response.status, body.slice(0, 500));
    }
    return (await response.json()) as T;
  }
}

export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    readonly bodySnippet: string,
  ) {
    super(`Google API error ${status}`);
    this.name = 'GoogleApiError';
  }

  isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  isRateLimited(): boolean {
    return this.status === 429;
  }
}
