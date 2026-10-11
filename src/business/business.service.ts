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
  BusinessResponseDto,
  PublicBusinessResponseDto,
  PaginatedBusinessResponseDto,
} from './dto/business-response.dto';
import { Prisma } from '@prisma/client';
import { normalizeKeywordList } from './keyword-options.util';

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    try {
      const business = await this.prisma.business.create({
        data: this.normalizeBusinessWriteData(createBusinessDto),
      });
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

    const [data, total] = await Promise.all([
      this.prisma.business.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.business.count(),
    ]);

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
