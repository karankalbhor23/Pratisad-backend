import { Test, TestingModule } from '@nestjs/testing';
import { BusinessService } from './business.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('BusinessService', () => {
  let service: BusinessService;

  const mockPrismaService = {
    business: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockBusiness = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Restaurant',
    slug: 'test-restaurant',
    description: 'A great place to eat',
    localContext: null,
    keywordsRatingLow: [],
    keywordsRatingHigh: [],
    logoUrl: 'https://example.com/logo.png',
    coverImageUrl: 'https://example.com/cover.jpg',
    primaryColor: '#2563EB',
    googleReviewUrl: 'https://g.page/test-restaurant/review',
    isActive: true,
    createdAt: new Date('2026-10-09T10:00:00Z'),
    updatedAt: new Date('2026-10-09T10:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BusinessService>(BusinessService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a business successfully', async () => {
      mockPrismaService.business.create.mockResolvedValue(mockBusiness);

      const createDto = {
        name: 'Test Restaurant',
        slug: 'test-restaurant',
        description: 'A great place to eat',
      };

      const result = await service.create(createDto);

      expect(result).toEqual(mockBusiness);
      expect(mockPrismaService.business.create).toHaveBeenCalledWith({
        data: createDto,
      });
    });

    it('should throw ConflictException on duplicate slug', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '6.0.0',
        },
      );
      mockPrismaService.business.create.mockRejectedValue(prismaError);

      const createDto = {
        name: 'Test Restaurant',
        slug: 'test-restaurant',
      };

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'Business with this slug already exists',
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated businesses with correct metadata', async () => {
      const businesses = [mockBusiness, { ...mockBusiness, id: 'another-id' }];
      mockPrismaService.business.findMany.mockResolvedValue(businesses);
      mockPrismaService.business.count.mockResolvedValue(42);

      const query = { page: 2, limit: 10 };
      const result = await service.findAll(query);

      expect(result).toEqual({
        data: businesses,
        page: 2,
        limit: 10,
        total: 42,
        totalPages: 5, // ceil(42 / 10)
      });
      expect(mockPrismaService.business.findMany).toHaveBeenCalledWith({
        skip: 10, // (page 2 - 1) * limit 10
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should use default pagination values', async () => {
      mockPrismaService.business.findMany.mockResolvedValue([]);
      mockPrismaService.business.count.mockResolvedValue(0);

      const result = await service.findAll({});

      expect(result).toEqual({
        data: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
      expect(mockPrismaService.business.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a business by id', async () => {
      mockPrismaService.business.findUnique.mockResolvedValue(mockBusiness);

      const result = await service.findOne(mockBusiness.id);

      expect(result).toEqual(mockBusiness);
      expect(mockPrismaService.business.findUnique).toHaveBeenCalledWith({
        where: { id: mockBusiness.id },
      });
    });

    it('should throw NotFoundException when business not found', async () => {
      mockPrismaService.business.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        'Business not found',
      );
    });
  });

  describe('findBySlug', () => {
    it('should return a business by slug', async () => {
      mockPrismaService.business.findUnique.mockResolvedValue(mockBusiness);

      const result = await service.findBySlug('test-restaurant');

      expect(result).toEqual(mockBusiness);
      expect(mockPrismaService.business.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-restaurant' },
      });
    });

    it('should filter by active status when activeOnly is true', async () => {
      mockPrismaService.business.findFirst.mockResolvedValue(mockBusiness);

      const result = await service.findBySlug('test-restaurant', true);

      expect(result).toEqual(mockBusiness);
      expect(mockPrismaService.business.findFirst).toHaveBeenCalledWith({
        where: { slug: 'test-restaurant', isActive: true },
      });
    });

    it('should return null when slug not found', async () => {
      mockPrismaService.business.findUnique.mockResolvedValue(null);

      const result = await service.findBySlug('non-existent-slug');

      expect(result).toBeNull();
    });
  });

  describe('findPublicBySlug', () => {
    it('should return only public fields for active business', async () => {
      mockPrismaService.business.findFirst.mockResolvedValue(mockBusiness);

      const result = await service.findPublicBySlug('test-restaurant');

      expect(result).toEqual({
        name: mockBusiness.name,
        slug: mockBusiness.slug,
        description: mockBusiness.description,
        keywordsRatingLow: mockBusiness.keywordsRatingLow,
        keywordsRatingHigh: mockBusiness.keywordsRatingHigh,
        logoUrl: mockBusiness.logoUrl,
        coverImageUrl: mockBusiness.coverImageUrl,
        primaryColor: mockBusiness.primaryColor,
        googleReviewUrl: mockBusiness.googleReviewUrl,
      });
      // Should NOT contain: id, isActive, createdAt, updatedAt
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('isActive');
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('should throw NotFoundException for inactive business', async () => {
      mockPrismaService.business.findFirst.mockResolvedValue(null);

      await expect(service.findPublicBySlug('inactive-slug')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for non-existent slug', async () => {
      mockPrismaService.business.findFirst.mockResolvedValue(null);

      await expect(
        service.findPublicBySlug('non-existent-slug'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findPublicBySlug('non-existent-slug'),
      ).rejects.toThrow('Business not found');
    });
  });

  describe('update', () => {
    it('should update a business successfully', async () => {
      const updatedBusiness = { ...mockBusiness, name: 'Updated Restaurant' };
      mockPrismaService.business.update.mockResolvedValue(updatedBusiness);

      const updateDto = { name: 'Updated Restaurant' };
      const result = await service.update(mockBusiness.id, updateDto);

      expect(result).toEqual(updatedBusiness);
      expect(mockPrismaService.business.update).toHaveBeenCalledWith({
        where: { id: mockBusiness.id },
        data: updateDto,
      });
    });

    it('should throw NotFoundException when updating non-existent business', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        {
          code: 'P2025',
          clientVersion: '6.0.0',
        },
      );
      mockPrismaService.business.update.mockRejectedValue(prismaError);

      await expect(
        service.update('non-existent-id', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on duplicate slug during update', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '6.0.0',
        },
      );
      mockPrismaService.business.update.mockRejectedValue(prismaError);

      await expect(
        service.update(mockBusiness.id, { slug: 'existing-slug' }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.update(mockBusiness.id, { slug: 'existing-slug' }),
      ).rejects.toThrow('Business with this slug already exists');
    });
  });
});
