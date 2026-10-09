import { Test, TestingModule } from '@nestjs/testing';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';

describe('BusinessController', () => {
  let controller: BusinessController;

  const mockBusinessService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findPublicBySlug: jest.fn(),
    update: jest.fn(),
  };

  const mockBusiness = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Restaurant',
    slug: 'test-restaurant',
    description: 'A great place to eat',
    logoUrl: 'https://example.com/logo.png',
    coverImageUrl: 'https://example.com/cover.jpg',
    primaryColor: '#2563EB',
    googleReviewUrl: 'https://g.page/test-restaurant/review',
    isActive: true,
    createdAt: new Date('2026-10-09T10:00:00Z'),
    updatedAt: new Date('2026-10-09T10:00:00Z'),
  };

  const mockPublicBusiness = {
    name: 'Test Restaurant',
    slug: 'test-restaurant',
    description: 'A great place to eat',
    logoUrl: 'https://example.com/logo.png',
    coverImageUrl: 'https://example.com/cover.jpg',
    primaryColor: '#2563EB',
    googleReviewUrl: 'https://g.page/test-restaurant/review',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessController],
      providers: [
        {
          provide: BusinessService,
          useValue: mockBusinessService,
        },
      ],
    }).compile();

    controller = module.get<BusinessController>(BusinessController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a business successfully', async () => {
      mockBusinessService.create.mockResolvedValue(mockBusiness);

      const createDto = {
        name: 'Test Restaurant',
        slug: 'test-restaurant',
      };

      const result = await controller.create(createDto);

      expect(result).toEqual(mockBusiness);
      expect(mockBusinessService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated businesses', async () => {
      const paginatedResponse = {
        data: [mockBusiness],
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      };
      mockBusinessService.findAll.mockResolvedValue(paginatedResponse);

      const query = { page: 1, limit: 20 };
      const result = await controller.findAll(query);

      expect(result).toEqual(paginatedResponse);
      expect(mockBusinessService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return a business by id', async () => {
      mockBusinessService.findOne.mockResolvedValue(mockBusiness);

      const result = await controller.findOne(mockBusiness.id);

      expect(result).toEqual(mockBusiness);
      expect(mockBusinessService.findOne).toHaveBeenCalledWith(mockBusiness.id);
    });
  });

  describe('findPublicBySlug', () => {
    it('should return public business data by slug', async () => {
      mockBusinessService.findPublicBySlug.mockResolvedValue(
        mockPublicBusiness,
      );

      const result = await controller.findPublicBySlug('test-restaurant');

      expect(result).toEqual(mockPublicBusiness);
      expect(mockBusinessService.findPublicBySlug).toHaveBeenCalledWith(
        'test-restaurant',
      );
    });
  });

  describe('update', () => {
    it('should update a business', async () => {
      const updatedBusiness = { ...mockBusiness, name: 'Updated Restaurant' };
      mockBusinessService.update.mockResolvedValue(updatedBusiness);

      const updateDto = { name: 'Updated Restaurant' };
      const result = await controller.update(mockBusiness.id, updateDto);

      expect(result).toEqual(updatedBusiness);
      expect(mockBusinessService.update).toHaveBeenCalledWith(
        mockBusiness.id,
        updateDto,
      );
    });
  });
});
