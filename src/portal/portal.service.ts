import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PortalInsightsDto = {
  totalSubmissions: number;
  averageRating: number | null;
  ratingCounts: Record<string, number>;
  topKeywords: Array<{ keyword: string; count: number }>;
  unreadPrivateCount: number;
};

export type PortalFeedbackItemDto = {
  id: string;
  rating: number;
  keywords: string[];
  comment: string | null;
  isPrivate: boolean;
  readAt: string | null;
  source: string;
  createdAt: string;
};

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getInsights(businessId: string): Promise<PortalInsightsDto> {
    const [totalSubmissions, avgRow, ratingGroups, unreadPrivateCount] =
      await Promise.all([
        this.prisma.feedbackSubmission.count({ where: { businessId } }),
        this.prisma.feedbackSubmission.aggregate({
          where: { businessId },
          _avg: { rating: true },
        }),
        this.prisma.feedbackSubmission.groupBy({
          by: ['rating'],
          where: { businessId },
          _count: { _all: true },
        }),
        this.prisma.feedbackSubmission.count({
          where: { businessId, isPrivate: true, readAt: null },
        }),
      ]);

    const ratingCounts: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    for (const group of ratingGroups) {
      ratingCounts[String(group.rating)] = group._count._all;
    }

    const keywordRows = await this.prisma.$queryRaw<
      Array<{ keyword: string; count: bigint }>
    >(Prisma.sql`
      SELECT kw AS keyword, COUNT(*)::bigint AS count
      FROM feedback_submissions fs
      CROSS JOIN LATERAL unnest(fs.keywords) AS kw
      WHERE fs."businessId" = ${businessId}
      GROUP BY kw
      ORDER BY count DESC
      LIMIT 10
    `);

    const topKeywords = keywordRows.map((row) => ({
      keyword: row.keyword,
      count: Number(row.count),
    }));

    return {
      totalSubmissions,
      averageRating: avgRow._avg.rating,
      ratingCounts,
      topKeywords,
      unreadPrivateCount,
    };
  }

  async listFeedback(
    businessId: string,
    options: {
      page: number;
      limit: number;
      privateOnly?: boolean;
      unreadOnly?: boolean;
    },
  ): Promise<{
    data: PortalFeedbackItemDto[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const where: Prisma.FeedbackSubmissionWhereInput = { businessId };
    if (options.privateOnly) where.isPrivate = true;
    if (options.unreadOnly) where.readAt = null;

    const skip = (options.page - 1) * options.limit;
    const [rows, total] = await Promise.all([
      this.prisma.feedbackSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: options.limit,
      }),
      this.prisma.feedbackSubmission.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        keywords: row.keywords,
        comment: row.comment,
        isPrivate: row.isPrivate,
        readAt: row.readAt?.toISOString() ?? null,
        source: row.source,
        createdAt: row.createdAt.toISOString(),
      })),
      page: options.page,
      limit: options.limit,
      total,
      totalPages: Math.ceil(total / options.limit) || 1,
    };
  }

  async markRead(businessId: string, feedbackId: string): Promise<void> {
    const result = await this.prisma.feedbackSubmission.updateMany({
      where: { id: feedbackId, businessId },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Feedback not found');
    }
  }
}
