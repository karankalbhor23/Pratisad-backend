import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type BusinessUsageSummary = {
  lifetimeDrafts: number;
  monthDrafts: number;
  lastDraftAt: string | null;
};

@Injectable()
export class AiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  startOfMonthUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  async getUsageForBusiness(businessId: string): Promise<BusinessUsageSummary> {
    const monthStart = this.startOfMonthUtc();
    const [lifetimeDrafts, monthDrafts, last] = await Promise.all([
      this.prisma.aiUsageEvent.count({
        where: { businessId, success: true },
      }),
      this.prisma.aiUsageEvent.count({
        where: { businessId, success: true, createdAt: { gte: monthStart } },
      }),
      this.prisma.aiUsageEvent.findFirst({
        where: { businessId, success: true },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);
    return {
      lifetimeDrafts,
      monthDrafts,
      lastDraftAt: last?.createdAt.toISOString() ?? null,
    };
  }

  async monthCountsByBusinessIds(
    businessIds: string[],
  ): Promise<Map<string, number>> {
    if (!businessIds.length) return new Map();
    const monthStart = this.startOfMonthUtc();
    const grouped = await this.prisma.aiUsageEvent.groupBy({
      by: ['businessId'],
      where: {
        businessId: { in: businessIds },
        success: true,
        createdAt: { gte: monthStart },
      },
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const row of grouped) {
      map.set(row.businessId, row._count._all);
    }
    return map;
  }
}
