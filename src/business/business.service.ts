import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { ListBusinessesQueryDto } from './dto/list-businesses-query.dto';
import {
  BusinessListItemDto,
  BusinessResponseDto,
  PublicBusinessResponseDto,
  PaginatedBusinessResponseDto,
} from './dto/business-response.dto';
import { BusinessMemberStatus, Prisma } from '@prisma/client';
import { AiUsageService } from './ai-usage.service';
import { BusinessMembersService } from './business-members.service';
import { normalizeKeywordList } from './keyword-options.util';

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiUsage: AiUsageService,
    private readonly members: BusinessMembersService,
  ) {}

  private normalizeBusinessWriteData<
    T extends CreateBusinessDto | UpdateBusinessDto,
  >(dto: T): T {
    const data = { ...dto };
    if (dto.localContext !== undefined) {
      const trimmed = dto.localContext?.trim();
      (data as { localContext?: string | null }).localContext = trimmed || null;
    }
    if (dto.keywordsRatingLow !== undefined) {
      data.keywordsRatingLow = normalizeKeywordList(dto.keywordsRatingLow);
    }
    if (dto.keywordsRatingHigh !== undefined) {
      data.keywordsRatingHigh = normalizeKeywordList(dto.keywordsRatingHigh);
    }
    return data;
  }

  async create(
    createBusinessDto: CreateBusinessDto,
  ): Promise<BusinessResponseDto> {
    const { portalUsername, portalPassword, ...businessFields } =
      createBusinessDto;
    try {
      const business = await this.prisma.business.create({
        data: this.normalizeBusinessWriteData(
          businessFields as CreateBusinessDto,
        ),
      });
      try {
        await this.members.provisionPortalUser(
          business.id,
          portalUsername,
          portalPassword,
        );
      } catch (provisionError) {
        await this.prisma.business.delete({ where: { id: business.id } });
        throw provisionError;
      }
      this.logger.log(`Created business: ${business.slug} (${business.id})`);
      return business;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Business with this slug already exists');
      }
      throw error;
    }
  }

  async findAll(
    query: ListBusinessesQueryDto,
  ): Promise<PaginatedBusinessResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.business.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { member: { select: { status: true } } },
      }),
      this.prisma.business.count(),
    ]);

    const monthCounts = await this.aiUsage.monthCountsByBusinessIds(
      rows.map((row) => row.id),
    );

    const data: BusinessListItemDto[] = rows.map(({ member, ...row }) => {
      const portalUserStatus: BusinessListItemDto['portalUserStatus'] =
        !member || member.status === BusinessMemberStatus.revoked
          ? 'none'
          : member.status;
      return {
        ...row,
        aiDraftCountMonth: monthCounts.get(row.id) ?? 0,
        portalUserStatus,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      page,
      limit,
      total,
      totalPages,
    };
  }

  async findOne(id: string): Promise<BusinessResponseDto> {
    const business = await this.prisma.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    return business;
  }

  async findBySlug(
    slug: string,
    activeOnly = false,
  ): Promise<BusinessResponseDto | null> {
    if (activeOnly) {
      const business = await this.prisma.business.findFirst({
        where: {
          slug,
          isActive: true,
        },
      });
      return business;
    }

    const business = await this.prisma.business.findUnique({
      where: { slug },
    });

    return business;
  }

  async findPublicBySlug(slug: string): Promise<PublicBusinessResponseDto> {
    const business = await this.findBySlug(slug, true);

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    // Return only public fields
    return {
      name: business.name,
      slug: business.slug,
      description: business.description,
      keywordsRatingLow: business.keywordsRatingLow,
      keywordsRatingHigh: business.keywordsRatingHigh,
      logoUrl: business.logoUrl,
      coverImageUrl: business.coverImageUrl,
      primaryColor: business.primaryColor,
      googleReviewUrl: business.googleReviewUrl,
    };
  }

  async getFeedbackSummary(businessId: string): Promise<{
    total: number;
    privateCount: number;
    unreadPrivateCount: number;
  }> {
    await this.findOne(businessId);
    const [total, privateCount, unreadPrivateCount] = await Promise.all([
      this.prisma.feedbackSubmission.count({ where: { businessId } }),
      this.prisma.feedbackSubmission.count({
        where: { businessId, isPrivate: true },
      }),
      this.prisma.feedbackSubmission.count({
        where: { businessId, isPrivate: true, readAt: null },
      }),
    ]);
    return { total, privateCount, unreadPrivateCount };
  }

  async clearFeedback(businessId: string): Promise<{ deletedCount: number }> {
    await this.findOne(businessId);
    const result = await this.prisma.feedbackSubmission.deleteMany({
      where: { businessId },
    });
    this.logger.log(
      `Cleared ${result.count} feedback submissions for business ${businessId}`,
    );
    return { deletedCount: result.count };
  }

  async update(
    id: string,
    updateBusinessDto: UpdateBusinessDto,
  ): Promise<BusinessResponseDto> {
    try {
      const business = await this.prisma.business.update({
        where: { id },
        data: this.normalizeBusinessWriteData(updateBusinessDto),
      });
      this.logger.log(`Updated business: ${business.slug} (${business.id})`);
      return business;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Business with this slug already exists');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Business not found');
        }
      }
      throw error;
    }
  }
}
