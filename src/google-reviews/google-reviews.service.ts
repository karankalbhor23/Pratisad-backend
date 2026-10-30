import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleReviewProcessingState,
  GoogleReviewReplyMode,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  GoogleApiError,
  GoogleBusinessApiClient,
} from './google-business-api.client';
import { userMessageForGoogleApiError } from './google-api-user-messages';
import { reviewsApiLocationName } from './google-location.util';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleReplyGeneratorService } from './google-reply-generator.service';
import {
  mapGoogleStarRating,
  resolveReplyAction,
} from './google-reply-rules';
import { GoogleTokenCipher } from './google-token.cipher';

type GoogleReviewsDb = PrismaService | Prisma.TransactionClient;

export type GoogleReviewsStatusDto = {
  allowed: boolean;
  enabled: boolean;
  connected: boolean;
  googleAccountEmail: string | null;
  locationName: string | null;
  locationTitle: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  pendingApprovalCount: number;
  oauthServerConfigured: boolean;
};

export type GoogleReviewListItemDto = {
  id: string;
  starRating: number;
  comment: string | null;
  reviewerDisplayName: string | null;
  reviewCreateTime: string | null;
  replyComment: string | null;
  draftReplyText: string | null;
  processingState: GoogleReviewProcessingState;
  syncedAt: string;
};

@Injectable()
export class GoogleReviewsService {
  private readonly logger = new Logger(GoogleReviewsService.name);
  private cronRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly oauth: GoogleOAuthService,
    private readonly cipher: GoogleTokenCipher,
    private readonly googleApi: GoogleBusinessApiClient,
    private readonly replyGenerator: GoogleReplyGeneratorService,
  ) {}

  async getStatus(businessId: string): Promise<GoogleReviewsStatusDto> {
    const business = await this.requireBusiness(businessId);
    const connection = await this.prisma.googleBusinessConnection.findUnique({
      where: { businessId },
    });
    const pendingApprovalCount = business.googleAutoReplyAllowed
      ? await this.prisma.googleReview.count({
          where: {
            businessId,
            processingState: GoogleReviewProcessingState.pending_approval,
          },
        })
      : 0;

    const oauthServerConfigured = this.oauth.isOAuthConfigured();

    return {
      allowed: business.googleAutoReplyAllowed,
      enabled: business.googleAutoReplyEnabled,
      connected: Boolean(connection && !connection.disconnectedAt),
      googleAccountEmail: connection?.googleAccountEmail ?? null,
      locationName: business.googleLocationName,
      locationTitle: business.googleLocationTitle,
      lastSyncAt: connection?.lastSyncAt?.toISOString() ?? null,
      lastError: connection?.lastError ?? null,
      pendingApprovalCount,
      oauthServerConfigured,
    };
  }

  async setAllowedByAdmin(
    businessId: string,
    allowed: boolean,
  ): Promise<{ googleAutoReplyAllowed: boolean }> {
    await this.requireBusiness(businessId);
    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        googleAutoReplyAllowed: allowed,
        ...(allowed ? {} : { googleAutoReplyEnabled: false }),
      },
      select: { googleAutoReplyAllowed: true },
    });
    return business;
  }

  async startOAuth(businessId: string, clerkUserId: string): Promise<{ url: string }> {
    await this.assertAllowed(businessId);
    const url = await this.oauth.createAuthorizationUrl(businessId, clerkUserId);
    return { url };
  }

  async completeOAuth(code: string, state: string): Promise<{ businessId: string }> {
    if (!this.cipher.isConfigured()) {
      throw new BadRequestException('Google integration is not fully configured.');
    }
    const { businessId, tokens } = await this.oauth.consumeCallback(code, state);
    await this.assertAllowed(businessId);

    const accessToken = tokens.access_token;
    let primaryAccountName: string | null = null;
    let primaryAccountEmail: string | null = null;
    try {
      const accounts = await this.googleApi.listAccounts(accessToken);
      const primary = accounts[0];
      primaryAccountName = primary?.name ?? null;
      primaryAccountEmail = primary?.accountName ?? null;
    } catch (error) {
      this.logger.warn(
        `listAccounts after OAuth failed for business ${businessId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const encryptedRefresh = this.cipher.encrypt(tokens.refresh_token!);
    const encryptedAccess = this.cipher.encrypt(accessToken);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await this.prisma.googleBusinessConnection.upsert({
      where: { businessId },
      create: {
        businessId,
        googleAccountEmail: primaryAccountEmail,
        googleAccountName: primaryAccountName,
        refreshTokenEncrypted: encryptedRefresh,
        accessTokenEncrypted: encryptedAccess,
        accessTokenExpiresAt: expiresAt,
        scopes: tokens.scope ?? null,
        disconnectedAt: null,
        lastError: primaryAccountName
          ? null
          : 'Could not list Google Business accounts. Request GBP API access in Google Cloud if quota is 0 (see DEPLOYMENT.md).',
      },
      update: {
        googleAccountEmail: primaryAccountEmail,
        googleAccountName: primaryAccountName,
        refreshTokenEncrypted: encryptedRefresh,
        accessTokenEncrypted: encryptedAccess,
        accessTokenExpiresAt: expiresAt,
        scopes: tokens.scope ?? null,
        disconnectedAt: null,
        lastError: primaryAccountName
          ? null
          : 'Could not list Google Business accounts. Request GBP API access in Google Cloud if quota is 0 (see DEPLOYMENT.md).',
        tokenVersion: { increment: 1 },
      },
    });

    return { businessId };
  }

  async listLocations(businessId: string) {
    await this.assertAllowed(businessId);
    const accessToken = await this.getValidAccessToken(businessId);
    let connection = await this.requireConnection(businessId);
    let accountName = connection.googleAccountName;
    try {
      if (!accountName) {
        const accounts = await this.googleApi.listAccounts(accessToken);
        const primary = accounts[0];
        if (!primary?.name) {
          throw new BadRequestException(
            'No Google Business account found for this Google user. Use the Google account that manages the business on Google Business Profile.',
          );
        }
        accountName = primary.name;
        connection = await this.prisma.googleBusinessConnection.update({
          where: { businessId },
          data: {
            googleAccountName: primary.name,
            googleAccountEmail: primary.accountName ?? null,
            lastError: null,
          },
        });
      }
      const locations = await this.googleApi.listLocations(accessToken, accountName);
      return locations.map((loc) => ({
        name: loc.name,
        title: loc.title ?? loc.name,
        addressLines: loc.storefrontAddress?.addressLines ?? [],
      }));
    } catch (error) {
      const message = userMessageForGoogleApiError(error);
      if (error instanceof GoogleApiError) {
        await this.prisma.googleBusinessConnection.update({
          where: { businessId },
          data: { lastError: message.slice(0, 500) },
        });
      }
      throw new BadRequestException(message);
    }
  }

  async setLocation(
    businessId: string,
    locationName: string,
    locationTitle: string,
  ): Promise<void> {
    await this.assertAllowed(businessId);
    if (!locationName.trim()) {
      throw new BadRequestException('Location is required.');
    }
    await this.requireConnection(businessId);
    const connection = await this.prisma.googleBusinessConnection.findUnique({
      where: { businessId },
    });
    const locationForReviews = reviewsApiLocationName(
      connection?.googleAccountName,
      locationName.trim(),
    );
    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        googleLocationName: locationForReviews,
        googleLocationTitle: locationTitle.trim() || locationName.trim(),
      },
    });
  }

  async updateSettings(
    businessId: string,
    enabled: boolean,
  ): Promise<{ googleAutoReplyEnabled: boolean }> {
    const business = await this.assertAllowed(businessId);
    if (enabled) {
      await this.requireConnection(businessId);
      if (!business.googleLocationName) {
        throw new BadRequestException('Select a Google location before enabling auto-reply.');
      }
    }
    return this.prisma.business.update({
      where: { id: businessId },
      data: { googleAutoReplyEnabled: enabled },
      select: { googleAutoReplyEnabled: true },
    });
  }

  async disconnect(businessId: string): Promise<void> {
    await this.assertAllowed(businessId);
    const connection = await this.prisma.googleBusinessConnection.findUnique({
      where: { businessId },
    });
    if (connection && !connection.disconnectedAt) {
      try {
        const refresh = this.cipher.decrypt(connection.refreshTokenEncrypted);
        await this.googleApi.revokeToken(
          refresh,
          this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID') ?? '',
          this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET') ?? '',
        );
      } catch {
        // Continue disconnect locally.
      }
    }
    await this.prisma.$transaction([
      this.prisma.googleBusinessConnection.updateMany({
        where: { businessId },
        data: { disconnectedAt: new Date() },
      }),
      this.prisma.business.update({
        where: { id: businessId },
        data: {
          googleAutoReplyEnabled: false,
          googleLocationName: null,
          googleLocationTitle: null,
        },
      }),
    ]);
  }

  async syncBusinessReviews(
    businessId: string,
    db: GoogleReviewsDb = this.prisma,
  ): Promise<{ synced: number }> {
    const business = await this.assertAllowed(businessId, db);
    if (!business.googleLocationName) {
      throw new BadRequestException('Select a Google location first.');
    }
    const connection = await this.requireConnection(businessId, db);
    const locationForReviews = reviewsApiLocationName(
      connection.googleAccountName,
      business.googleLocationName,
    );

    try {
      const accessToken = await this.getValidAccessToken(businessId, db);
      let synced = 0;
      let pageToken: string | undefined;
      do {
        const page = await this.googleApi.listReviews(
          accessToken,
          locationForReviews,
          pageToken,
        );
        for (const review of page.reviews) {
          await this.upsertReviewFromGoogle(business, review, db);
          synced += 1;
        }
        pageToken = page.nextPageToken;
      } while (pageToken);

      if (locationForReviews !== business.googleLocationName) {
        await db.business.update({
          where: { id: businessId },
          data: { googleLocationName: locationForReviews },
        });
      }

      await db.googleBusinessConnection.update({
        where: { businessId },
        data: { lastSyncAt: new Date(), lastError: null },
      });

      await this.processPendingRepliesForBusiness(businessId, db);
      return { synced };
    } catch (error) {
      const message = userMessageForGoogleApiError(error);
      this.logger.warn(
        `syncBusinessReviews failed for ${businessId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (error instanceof GoogleApiError) {
        await db.googleBusinessConnection.update({
          where: { businessId },
          data: { lastError: message.slice(0, 500) },
        });
        throw new BadRequestException(message);
      }
      throw error;
    }
  }

  async listReviews(
    businessId: string,
    query: { page?: number; limit?: number; state?: GoogleReviewProcessingState },
  ): Promise<{
    data: GoogleReviewListItemDto[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    await this.assertAllowed(businessId);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const skip = (page - 1) * limit;
    const where: Prisma.GoogleReviewWhereInput = {
      businessId,
      ...(query.state ? { processingState: query.state } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.googleReview.findMany({
        where,
        orderBy: { syncedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.googleReview.count({ where }),
    ]);
    return {
      data: rows.map((row) => this.toListItem(row)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async approveReview(
    businessId: string,
    reviewId: string,
    replyText: string,
  ): Promise<void> {
    await this.assertAllowed(businessId);
    const review = await this.prisma.googleReview.findFirst({
      where: { id: reviewId, businessId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (
      review.processingState !== GoogleReviewProcessingState.pending_approval &&
      review.processingState !== GoogleReviewProcessingState.failed
    ) {
      throw new BadRequestException('This review is not awaiting approval.');
    }
    const text = replyText.trim() || review.draftReplyText?.trim();
    if (!text) throw new BadRequestException('Reply text is required.');
    await this.postReply(businessId, review, text, GoogleReviewReplyMode.approved);
  }

  async regenerateDraft(businessId: string, reviewId: string): Promise<{ draft: string }> {
    await this.assertAllowed(businessId);
    const review = await this.prisma.googleReview.findFirst({
      where: { id: reviewId, businessId },
      include: { business: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    const draft = await this.replyGenerator.generateReply({
      businessName: review.business.name,
      localContext: review.business.localContext,
      starRating: review.starRating,
      reviewComment: review.comment,
      reviewerDisplayName: review.reviewerDisplayName,
    });
    await this.prisma.googleReview.update({
      where: { id: review.id },
      data: {
        draftReplyText: draft,
        processingState: GoogleReviewProcessingState.pending_approval,
      },
    });
    return { draft };
  }

  async dismissReview(businessId: string, reviewId: string): Promise<void> {
    await this.assertAllowed(businessId);
    const result = await this.prisma.googleReview.updateMany({
      where: {
        id: reviewId,
        businessId,
        processingState: {
          in: [
            GoogleReviewProcessingState.pending_approval,
            GoogleReviewProcessingState.failed,
            GoogleReviewProcessingState.synced,
          ],
        },
      },
      data: { processingState: GoogleReviewProcessingState.skipped },
    });
    if (!result.count) throw new NotFoundException('Review not found');
  }

  async runScheduledSync(): Promise<void> {
    if (this.cronRunning) return;
    this.cronRunning = true;
    try {
      await this.prisma.$transaction(async (tx) => {
        const lockRows = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext('pratisad_google_reviews_sync')) AS locked
        `;
        if (lockRows[0]?.locked !== true) return;

        const businesses = await tx.business.findMany({
          where: {
            googleAutoReplyAllowed: true,
            googleLocationName: { not: null },
            googleBusinessConnection: { is: { disconnectedAt: null } },
            OR: [
              { googleAutoReplyEnabled: true },
              { googleReviews: { some: { processingState: GoogleReviewProcessingState.pending_approval } } },
            ],
          },
          select: { id: true },
        });

        for (const { id } of businesses) {
          try {
            await this.syncBusinessReviews(id, tx);
          } catch (error) {
            this.logger.warn(`Scheduled sync failed for business ${id}: ${String(error)}`);
          }
        }
      });
    } finally {
      this.cronRunning = false;
    }
  }

  private async upsertReviewFromGoogle(
    business: {
      id: string;
      name: string;
      localContext: string | null;
      googleAutoReplyEnabled: boolean;
    },
    review: {
      name: string;
      starRating?: string;
      comment?: string;
      reviewer?: { displayName?: string };
      createTime?: string;
      reviewReply?: { comment?: string; updateTime?: string };
    },
    db: GoogleReviewsDb = this.prisma,
  ): Promise<void> {
    const starRating = mapGoogleStarRating(review.starRating);
    if (!starRating || !review.name) return;

    const existing = await db.googleReview.findUnique({
      where: { googleReviewName: review.name },
    });

    const hasReply = Boolean(review.reviewReply?.comment?.trim());
    const baseData = {
      starRating,
      comment: review.comment?.trim() || null,
      reviewerDisplayName: review.reviewer?.displayName?.trim() || null,
      reviewCreateTime: review.createTime ? new Date(review.createTime) : null,
      replyComment: review.reviewReply?.comment?.trim() || null,
      replyUpdateTime: review.reviewReply?.updateTime
        ? new Date(review.reviewReply.updateTime)
        : null,
      syncedAt: new Date(),
    };

    if (existing) {
      await db.googleReview.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          ...(hasReply && existing.processingState !== GoogleReviewProcessingState.posted
            ? { processingState: GoogleReviewProcessingState.skipped }
            : {}),
        },
      });
      return;
    }

    const action = resolveReplyAction({
      starRating,
      autoReplyEnabled: business.googleAutoReplyEnabled,
      hasExistingReply: hasReply,
    });

    let processingState: GoogleReviewProcessingState =
      GoogleReviewProcessingState.synced;
    if (action === 'skip_has_reply') {
      processingState = GoogleReviewProcessingState.skipped;
    } else if (action === 'pending_approval') {
      processingState = GoogleReviewProcessingState.pending_approval;
    } else if (action === 'auto_post') {
      processingState = GoogleReviewProcessingState.queued_post;
    }

    const created = await db.googleReview.create({
      data: {
        businessId: business.id,
        googleReviewName: review.name,
        processingState,
        ...baseData,
      },
    });

    if (
      processingState === GoogleReviewProcessingState.pending_approval ||
      processingState === GoogleReviewProcessingState.queued_post
    ) {
      try {
        const draft = await this.replyGenerator.generateReply({
          businessName: business.name,
          localContext: business.localContext,
          starRating,
          reviewComment: created.comment,
          reviewerDisplayName: created.reviewerDisplayName,
        });
        await db.googleReview.update({
          where: { id: created.id },
          data: { draftReplyText: draft },
        });
        if (processingState === GoogleReviewProcessingState.queued_post) {
          await this.postReply(
            business.id,
            { ...created, draftReplyText: draft },
            draft,
            GoogleReviewReplyMode.auto,
            db,
          );
        }
      } catch (error) {
        await db.googleReview.update({
          where: { id: created.id },
          data: { processingState: GoogleReviewProcessingState.failed },
        });
        this.logger.warn(`Draft/post failed for review ${created.id}: ${String(error)}`);
      }
    }
  }

  private async processPendingRepliesForBusiness(
    businessId: string,
    db: GoogleReviewsDb = this.prisma,
  ): Promise<void> {
    const business = await db.business.findUnique({
      where: { id: businessId },
    });
    if (!business?.googleAutoReplyEnabled) return;

    const queued = await db.googleReview.findMany({
      where: {
        businessId,
        processingState: GoogleReviewProcessingState.queued_post,
      },
    });
    for (const review of queued) {
      const text = review.draftReplyText?.trim();
      if (!text) continue;
      try {
        await this.postReply(businessId, review, text, GoogleReviewReplyMode.auto, db);
      } catch {
        // postReply records failure
      }
    }
  }

  private async postReply(
    businessId: string,
    review: {
      id: string;
      googleReviewName: string;
      draftReplyText: string | null;
    },
    replyText: string,
    mode: GoogleReviewReplyMode,
    db: GoogleReviewsDb = this.prisma,
  ): Promise<void> {
    const accessToken = await this.getValidAccessToken(businessId, db);
    await db.googleReview.update({
      where: { id: review.id },
      data: { processingState: GoogleReviewProcessingState.queued_post },
    });

    try {
      const live = await this.googleApi.getReview(accessToken, review.googleReviewName);
      if (live.reviewReply?.comment?.trim()) {
        await db.googleReview.update({
          where: { id: review.id },
          data: {
            processingState: GoogleReviewProcessingState.skipped,
            replyComment: live.reviewReply.comment.trim(),
          },
        });
        return;
      }

      const posted = await this.googleApi.updateReply(
        accessToken,
        review.googleReviewName,
        replyText,
      );

      await this.runDbTransaction(db, async (client) => {
        await client.googleReview.update({
          where: { id: review.id },
          data: {
            processingState: GoogleReviewProcessingState.posted,
            replyComment: posted.comment ?? replyText,
            replyUpdateTime: posted.updateTime
              ? new Date(posted.updateTime)
              : new Date(),
            draftReplyText: replyText,
          },
        });
        await client.googleReviewReplyAttempt.create({
          data: {
            reviewId: review.id,
            mode,
            draftText: review.draftReplyText,
            postedText: replyText,
            success: true,
          },
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reply failed';
      const code =
        error instanceof GoogleApiError ? String(error.status) : 'unknown';
      await this.runDbTransaction(db, async (client) => {
        await client.googleReview.update({
          where: { id: review.id },
          data: { processingState: GoogleReviewProcessingState.failed },
        });
        await client.googleReviewReplyAttempt.create({
          data: {
            reviewId: review.id,
            mode,
            draftText: review.draftReplyText,
            postedText: replyText,
            success: false,
            errorCode: code,
            errorMessage: message.slice(0, 500),
          },
        });
      });
      if (error instanceof GoogleApiError && error.isAuthError()) {
        await this.handleAuthFailure(businessId, message, db);
      }
      throw error;
    }
  }

  private async handleAuthFailure(
    businessId: string,
    message: string,
    db: GoogleReviewsDb = this.prisma,
  ): Promise<void> {
    await this.runDbTransaction(db, async (client) => {
      await client.googleBusinessConnection.updateMany({
        where: { businessId },
        data: { lastError: message.slice(0, 500) },
      });
      await client.business.update({
        where: { id: businessId },
        data: { googleAutoReplyEnabled: false },
      });
    });
  }

  private async getValidAccessToken(
    businessId: string,
    db: GoogleReviewsDb = this.prisma,
  ): Promise<string> {
    const connection = await this.requireConnection(businessId, db);
    const now = Date.now();
    if (
      connection.accessTokenEncrypted &&
      connection.accessTokenExpiresAt &&
      connection.accessTokenExpiresAt.getTime() > now + 60_000
    ) {
      return this.cipher.decrypt(connection.accessTokenEncrypted);
    }
    const refresh = this.cipher.decrypt(connection.refreshTokenEncrypted);
    let tokens;
    try {
      tokens = await this.oauth.refreshAccessToken(refresh);
    } catch (error) {
      await this.handleAuthFailure(
        businessId,
        error instanceof Error ? error.message : 'Token refresh failed',
        db,
      );
      throw error;
    }
    const encryptedAccess = this.cipher.encrypt(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await db.googleBusinessConnection.update({
      where: { businessId },
      data: {
        accessTokenEncrypted: encryptedAccess,
        accessTokenExpiresAt: expiresAt,
        lastError: null,
      },
    });
    return tokens.access_token;
  }

  private toListItem(row: {
    id: string;
    starRating: number;
    comment: string | null;
    reviewerDisplayName: string | null;
    reviewCreateTime: Date | null;
    replyComment: string | null;
    draftReplyText: string | null;
    processingState: GoogleReviewProcessingState;
    syncedAt: Date;
  }): GoogleReviewListItemDto {
    return {
      id: row.id,
      starRating: row.starRating,
      comment: row.comment,
      reviewerDisplayName: row.reviewerDisplayName,
      reviewCreateTime: row.reviewCreateTime?.toISOString() ?? null,
      replyComment: row.replyComment,
      draftReplyText: row.draftReplyText,
      processingState: row.processingState,
      syncedAt: row.syncedAt.toISOString(),
    };
  }

  private async requireBusiness(businessId: string, db: GoogleReviewsDb = this.prisma) {
    const business = await db.business.findUnique({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  private async assertAllowed(businessId: string, db: GoogleReviewsDb = this.prisma) {
    const business = await this.requireBusiness(businessId, db);
    if (!business.googleAutoReplyAllowed) {
      throw new ForbiddenException('Google auto-reply is not enabled for this business.');
    }
    return business;
  }

  private async requireConnection(businessId: string, db: GoogleReviewsDb = this.prisma) {
    const connection = await db.googleBusinessConnection.findUnique({
      where: { businessId },
    });
    if (!connection || connection.disconnectedAt) {
      throw new BadRequestException('Connect Google Business first.');
    }
    return connection;
  }

  private async runDbTransaction(
    db: GoogleReviewsDb,
    work: (client: GoogleReviewsDb) => Promise<void>,
  ): Promise<void> {
    if (db === this.prisma) {
      await this.prisma.$transaction(async (tx) => work(tx));
      return;
    }
    await work(db);
  }
}
