import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/business.manage';
const STATE_TTL_MS = 10 * 60 * 1000;

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  isOAuthConfigured(): boolean {
    return Boolean(
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')?.trim() &&
        this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET')?.trim() &&
        this.getRedirectUri(),
    );
  }

  getRedirectUri(): string {
    const explicit = this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI')?.trim();
    if (explicit) return explicit;
    const port = this.config.get<string>('PORT') ?? '4000';
    return `http://localhost:${port}/integrations/google/callback`;
  }

  async createAuthorizationUrl(
    businessId: string,
    clerkUserId: string,
  ): Promise<string> {
    if (!this.isOAuthConfigured()) {
      throw new ServiceUnavailableException(
        'Google connection is not configured on the server.',
      );
    }
    const nonce = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + STATE_TTL_MS);
    await this.prisma.googleOAuthPendingState.create({
      data: { nonce, businessId, clerkUserId, expiresAt },
    });
    const state = this.signState({ nonce, businessId, clerkUserId, exp: expiresAt.getTime() });
    const params = new URLSearchParams({
      client_id: this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')!,
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async consumeCallback(
    code: string,
    state: string,
  ): Promise<{ businessId: string; clerkUserId: string; tokens: GoogleTokenResponse }> {
    const parsed = this.verifyState(state);
    const pending = await this.prisma.googleOAuthPendingState.findUnique({
      where: { nonce: parsed.nonce },
    });
    if (
      !pending ||
      pending.usedAt ||
      pending.businessId !== parsed.businessId ||
      pending.clerkUserId !== parsed.clerkUserId ||
      pending.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }
    await this.prisma.googleOAuthPendingState.update({
      where: { id: pending.id },
      data: { usedAt: new Date() },
    });

    const tokens = await this.exchangeCode(code);
    if (!tokens.refresh_token) {
      throw new BadRequestException(
        'Google did not return a refresh token. Disconnect the app in your Google account and try again with consent.',
      );
    }
    return {
      businessId: parsed.businessId,
      clerkUserId: parsed.clerkUserId,
      tokens,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    if (!this.isOAuthConfigured()) {
      throw new InternalServerErrorException('Google OAuth is not configured');
    }
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')!,
        client_secret: this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET')!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await response.json()) as GoogleTokenResponse & {
      error?: string;
    };
    if (!response.ok) {
      throw new BadRequestException(data.error ?? 'Token refresh failed');
    }
    return data;
  }

  private async exchangeCode(code: string): Promise<GoogleTokenResponse> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')!,
        client_secret: this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET')!,
        redirect_uri: this.getRedirectUri(),
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await response.json()) as GoogleTokenResponse & {
      error?: string;
    };
    if (!response.ok) {
      throw new BadRequestException(data.error ?? 'OAuth code exchange failed');
    }
    return data;
  }

  signState(payload: {
    nonce: string;
    businessId: string;
    clerkUserId: string;
    exp: number;
  }): string {
    const secret = this.stateSecret();
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  verifyState(state: string): {
    nonce: string;
    businessId: string;
    clerkUserId: string;
    exp: number;
  } {
    const [body, sig] = state.split('.');
    if (!body || !sig) throw new BadRequestException('Invalid OAuth state');
    const expected = createHmac('sha256', this.stateSecret())
      .update(body)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (
      sigBuf.length !== expectedBuf.length ||
      !timingSafeEqual(sigBuf, expectedBuf)
    ) {
      throw new BadRequestException('Invalid OAuth state signature');
    }
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      nonce: string;
      businessId: string;
      clerkUserId: string;
      exp: number;
    };
    if (!parsed.exp || parsed.exp < Date.now()) {
      throw new BadRequestException('OAuth state expired');
    }
    return parsed;
  }

  private stateSecret(): string {
    const secret =
      this.config.get<string>('GOOGLE_OAUTH_STATE_SECRET')?.trim() ??
      this.config.get<string>('CLERK_SECRET_KEY')?.trim();
    if (!secret) {
      throw new InternalServerErrorException('OAuth state secret is not configured');
    }
    return secret;
  }
}
