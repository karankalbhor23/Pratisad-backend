import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReviewCardStatus } from '@prisma/client';
import type { Archiver } from 'archiver';
import QRCode from 'qrcode';
import { Readable } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateReviewCardToken,
  isValidReviewCardToken,
  normalizeReviewCardToken,
} from './review-card-token.util';
import {
  ReviewCardResolveDto,
} from './review-cards.types';

const INSERT_CHUNK = 100;

const ASSIGNABLE_STATUSES = [
  ReviewCardStatus.unassigned,
  ReviewCardStatus.revoked,
];

export type BatchListItem = {
  id: string;
  label: string;
  quantity: number;
  createdAt: string;
  unassigned: number;
  assigned: number;
  revoked: number;
};

export type AssignedCardDto = {
  token: string;
  batchLabel: string;
  serialInBatch: number;
  scanCount: number;
  assignedAt: string | null;
  cardUrl: string;
};

@Injectable()
export class ReviewCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  getWebOrigin(): string {
    const origin = this.config.get<string>('WEB_APP_ORIGIN')?.replace(/\/+$/, '');
    if (!origin) {
      throw new ServiceUnavailableException(
        'WEB_APP_ORIGIN is not configured for review card URLs.',
      );
    }
    return origin;
  }

  cardUrl(token: string): string {
    return `${this.getWebOrigin()}/go/${token}`;
  }

  async createBatch(label: string, quantity: number) {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) throw new BadRequestException('Batch label is required.');

    const max =
      Number(this.config.get<string>('REVIEW_CARD_BATCH_MAX')) || 500;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) {
      throw new BadRequestException(
        `Quantity must be between 1 and ${max}.`,
      );
    }

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reviewCardBatch.create({
        data: { label: trimmedLabel, quantity },
      });

      for (let start = 1; start <= quantity; start += INSERT_CHUNK) {
        const end = Math.min(start + INSERT_CHUNK - 1, quantity);
        const rows: Array<{
          batchId: string;
          token: string;
          serialInBatch: number;
        }> = [];
        for (let serial = start; serial <= end; serial += 1) {
          rows.push({
            batchId: created.id,
            token: await this.uniqueToken(tx),
            serialInBatch: serial,
          });
        }
        await tx.reviewCard.createMany({ data: rows });
      }

      return created;
    });

    return this.getBatchById(batch.id);
  }

  private async uniqueToken(
    tx: Pick<PrismaService, 'reviewCard'>,
    attempts = 8,
  ): Promise<string> {
    for (let i = 0; i < attempts; i += 1) {
      const token = generateReviewCardToken();
      const exists = await tx.reviewCard.findUnique({ where: { token } });
      if (!exists) return token;
    }
    throw new ConflictException('Could not generate unique card token.');
  }

  async listBatches(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [batches, total] = await Promise.all([
      this.prisma.reviewCardBatch.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.reviewCardBatch.count(),
    ]);

    const data = await Promise.all(
      batches.map(async (batch) => this.toBatchListItem(batch.id, batch)),
    );

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getBatchById(id: string) {
    const batch = await this.prisma.reviewCardBatch.findUnique({
      where: { id },
    });
    if (!batch) throw new NotFoundException('Review card batch not found.');
    return this.toBatchListItem(batch.id, batch);
  }

  private async toBatchListItem(
    id: string,
    batch: { label: string; quantity: number; createdAt: Date },
  ): Promise<BatchListItem> {
    const [unassigned, assigned, revoked] = await Promise.all([
      this.prisma.reviewCard.count({
        where: { batchId: id, status: ReviewCardStatus.unassigned },
      }),
      this.prisma.reviewCard.count({
        where: { batchId: id, status: ReviewCardStatus.assigned },
      }),
      this.prisma.reviewCard.count({
        where: { batchId: id, status: ReviewCardStatus.revoked },
      }),
    ]);
    return {
      id,
      label: batch.label,
      quantity: batch.quantity,
      createdAt: batch.createdAt.toISOString(),
      unassigned,
      assigned,
      revoked,
    };
  }

  async listCardsInBatch(
    batchId: string,
    page = 1,
    limit = 50,
  ) {
    await this.getBatchById(batchId);
    const skip = (page - 1) * limit;
    const [cards, total] = await Promise.all([
      this.prisma.reviewCard.findMany({
        where: { batchId },
        orderBy: { serialInBatch: 'asc' },
        skip,
        take: limit,
        include: {
          business: { select: { name: true } },
          batch: { select: { label: true } },
        },
      }),
      this.prisma.reviewCard.count({ where: { batchId } }),
    ]);

    return {
      data: cards.map((card) => ({
        token: card.token,
        serialInBatch: card.serialInBatch,
        status: card.status,
        businessName: card.business?.name ?? null,
        batchLabel: card.batch.label,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  buildCsvExport(batchId: string): Promise<string> {
    return this.exportCsvBody(batchId);
  }

  private async exportCsvBody(batchId: string): Promise<string> {
    const batch = await this.prisma.reviewCardBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new NotFoundException('Review card batch not found.');

    const cards = await this.prisma.reviewCard.findMany({
      where: { batchId },
      orderBy: { serialInBatch: 'asc' },
    });

    const lines = [
      'serial_in_batch,token,url,batch_label',
      ...cards.map((card) => {
        const url = this.cardUrl(card.token);
        return [
          card.serialInBatch,
          csvEscape(card.token),
          csvEscape(url),
          csvEscape(batch.label),
        ].join(',');
      }),
    ];
    return lines.join('\n');
  }

  async buildQrZipStream(batchId: string): Promise<Readable> {
    const batch = await this.prisma.reviewCardBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new NotFoundException('Review card batch not found.');

    const cards = await this.prisma.reviewCard.findMany({
      where: { batchId },
      orderBy: { serialInBatch: 'asc' },
    });

    const { ZipArchive } = await import('archiver');
    if (!ZipArchive) {
      throw new ServiceUnavailableException('ZIP export is unavailable.');
    }
    const archive: Archiver = new ZipArchive({ zlib: { level: 6 } });
    const safeLabel = batch.label.replace(/[^a-zA-Z0-9._-]+/g, '_');

    for (const card of cards) {
      const url = this.cardUrl(card.token);
      const png = await QRCode.toBuffer(url, {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000ff',
          light: '#00000000',
        },
      });
      archive.append(png, {
        name: `${safeLabel}-${card.token}.png`,
      });
    }

    void archive.finalize();
    return archive;
  }

  async resolveToken(rawToken: string): Promise<ReviewCardResolveDto> {
    const token = normalizeReviewCardToken(rawToken);
    if (!isValidReviewCardToken(token)) {
      return { outcome: 'not_found' };
    }

    const card = await this.prisma.reviewCard.findUnique({
      where: { token },
      include: { business: { select: { slug: true, isActive: true } } },
    });

    if (!card) return { outcome: 'not_found' };
    if (card.status === ReviewCardStatus.unassigned) {
      return { outcome: 'unassigned' };
    }
    if (card.status === ReviewCardStatus.revoked) {
      return { outcome: 'revoked' };
    }
    if (card.status === ReviewCardStatus.assigned) {
      if (!card.business) return { outcome: 'revoked' };
      if (!card.business.isActive) return { outcome: 'business_inactive' };

      void this.prisma.reviewCard
        .update({
          where: { id: card.id },
          data: {
            scanCount: { increment: 1 },
            lastScannedAt: new Date(),
          },
        })
        .catch(() => undefined);

      return { outcome: 'redirect', slug: card.business.slug };
    }

    return { outcome: 'not_found' };
  }

  async listAssignedForBusiness(businessId: string): Promise<AssignedCardDto[]> {
    await this.assertBusinessExists(businessId);
    const cards = await this.prisma.reviewCard.findMany({
      where: {
        businessId,
        status: ReviewCardStatus.assigned,
      },
      orderBy: { assignedAt: 'desc' },
      include: { batch: { select: { label: true } } },
    });

    return cards.map((card) => ({
      token: card.token,
      batchLabel: card.batch.label,
      serialInBatch: card.serialInBatch,
      scanCount: card.scanCount,
      assignedAt: card.assignedAt?.toISOString() ?? null,
      cardUrl: this.cardUrl(card.token),
    }));
  }

  async inventorySummary() {
    const batches = await this.prisma.reviewCardBatch.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true },
    });
    const perBatch = await Promise.all(
      batches.map(async (batch) => ({
        batchId: batch.id,
        label: batch.label,
        available: await this.prisma.reviewCard.count({
          where: {
            batchId: batch.id,
            status: { in: ASSIGNABLE_STATUSES },
          },
        }),
      })),
    );
    const totalAvailable = perBatch.reduce((sum, b) => sum + b.available, 0);
    return { totalAvailable, batches: perBatch };
  }

  async assignToBusiness(
    businessId: string,
    input: { tokens?: string[]; batchId?: string; count?: number },
  ) {
    await this.assertBusinessExists(businessId);

    let tokensToAssign: string[] = [];

    if (input.tokens?.length) {
      tokensToAssign = input.tokens.map(normalizeReviewCardToken);
    } else if (input.batchId && input.count) {
      if (!Number.isInteger(input.count) || input.count < 1) {
        throw new BadRequestException('count must be a positive integer.');
      }
      const available = await this.prisma.reviewCard.count({
        where: {
          batchId: input.batchId,
          status: { in: ASSIGNABLE_STATUSES },
        },
      });
      if (input.count > available) {
        throw new BadRequestException(
          `Only ${available} available card(s) in this batch.`,
        );
      }
      const cards = await this.prisma.reviewCard.findMany({
        where: {
          batchId: input.batchId,
          status: { in: ASSIGNABLE_STATUSES },
        },
        orderBy: { serialInBatch: 'asc' },
        take: input.count,
        select: { token: true },
      });
      tokensToAssign = cards.map((c) => c.token);
    } else {
      throw new BadRequestException(
        'Provide tokens or batchId with count to assign cards.',
      );
    }

    const errors: Array<{ token: string; message: string }> = [];
    const assigned: string[] = [];
    const now = new Date();

    for (const token of tokensToAssign) {
      if (!isValidReviewCardToken(token)) {
        errors.push({ token, message: 'Invalid token format.' });
        continue;
      }

      const updated = await this.prisma.reviewCard.updateMany({
        where: {
          token,
          status: { in: ASSIGNABLE_STATUSES },
        },
        data: {
          status: ReviewCardStatus.assigned,
          businessId,
          assignedAt: now,
          revokedAt: null,
        },
      });

      if (updated.count === 1) {
        assigned.push(token);
        continue;
      }

      const existing = await this.prisma.reviewCard.findUnique({
        where: { token },
      });
      if (!existing) {
        errors.push({ token, message: 'Card not found.' });
      } else if (existing.status === ReviewCardStatus.assigned) {
        errors.push({ token, message: 'Card is already assigned.' });
      } else {
        errors.push({ token, message: 'Could not assign card.' });
      }
    }

    const cards = await this.listAssignedForBusiness(businessId);
    return {
      assignedTokens: assigned,
      errors,
      cards: cards.filter((c) => assigned.includes(c.token)),
    };
  }

  async revokeFromBusiness(businessId: string, tokens: string[]) {
    await this.assertBusinessExists(businessId);
    if (!tokens.length) {
      throw new BadRequestException('At least one token is required.');
    }

    const normalized = tokens.map(normalizeReviewCardToken);
    const now = new Date();
    const revoked: string[] = [];
    const errors: Array<{ token: string; message: string }> = [];

    for (const token of normalized) {
      const updated = await this.prisma.reviewCard.updateMany({
        where: {
          token,
          businessId,
          status: ReviewCardStatus.assigned,
        },
        data: {
          status: ReviewCardStatus.revoked,
          revokedAt: now,
          businessId: null,
        },
      });
      if (updated.count === 1) revoked.push(token);
      else errors.push({ token, message: 'Card not assigned to this business.' });
    }

    return { revokedTokens: revoked, errors };
  }

  private async assertBusinessExists(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business not found.');
  }
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
