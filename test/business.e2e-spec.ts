/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Business API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdBusinessIds: string[] = [];

  beforeAll(async () => {
    process.env.E2E_AUTH_BYPASS = 'true';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same validation configuration as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    if (createdBusinessIds.length > 0) {
      await prisma.business.deleteMany({
        where: {
          id: {
            in: createdBusinessIds,
          },
        },
      });
    }

    if (app) {
      await app.close();
    }
  }, 30000);

  describe('POST /businesses', () => {
    it('should create a business with valid data and return 201', async () => {
      const createDto = {
        name: 'E2E Test Restaurant',
        slug: 'e2e-test-restaurant',
        description: 'A test restaurant for e2e testing',
        logoUrl: 'https://example.com/logo.png',
        coverImageUrl: 'https://example.com/cover.jpg',
        primaryColor: '#2563EB',
        googleReviewUrl: 'https://g.page/test/review',
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: createDto.name,
        slug: createDto.slug,
        description: createDto.description,
        logoUrl: createDto.logoUrl,
        coverImageUrl: createDto.coverImageUrl,
        primaryColor: createDto.primaryColor,
        googleReviewUrl: createDto.googleReviewUrl,
        isActive: createDto.isActive,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');

      createdBusinessIds.push(response.body.id);
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          slug: 'missing-name',
        })
        .expect(400);

      expect(
        response.body.message.some((msg: string) => msg.includes('name')),
      ).toBe(true);
    });

    it('should return 400 when slug is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Missing Slug Business',
        })
        .expect(400);

      expect(
        response.body.message.some((msg: string) => msg.includes('slug')),
      ).toBe(true);
    });

    it('should return 400 with invalid slug format (uppercase)', async () => {
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Invalid Slug',
          slug: 'InvalidSlug',
        })
        .expect(400);

      expect(
        response.body.message.some((msg: string) =>
          msg.includes('Slug must contain only lowercase'),
        ),
      ).toBe(true);
    });

    it('should return 400 with invalid slug format (leading hyphen)', async () => {
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Invalid Slug',
          slug: '-invalid-slug',
        })
        .expect(400);

      expect(
        response.body.message.some((msg: string) =>
          msg.includes('Slug must contain only lowercase'),
        ),
      ).toBe(true);
    });

    it('should return 400 with invalid slug format (trailing hyphen)', async () => {
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Invalid Slug',
          slug: 'invalid-slug-',
        })
        .expect(400);

      expect(
        response.body.message.some((msg: string) =>
          msg.includes('Slug must contain only lowercase'),
        ),
      ).toBe(true);
    });

    it('should return 400 with invalid slug format (consecutive hyphens)', async () => {
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Invalid Slug',
          slug: 'invalid--slug',
        })
        .expect(400);

      expect(
        response.body.message.some((msg: string) =>
          msg.includes('Slug must contain only lowercase'),
        ),
      ).toBe(true);
    });

    it('should return 400 with slug too short', async () => {
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Short Slug',
          slug: 'a',
        })
        .expect(400);

      expect(response.body.message).toContain(
        'slug must be longer than or equal to 2 characters',
      );
    });

    it('should return 400 with slug too long', async () => {
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Long Slug',
          slug: 'a'.repeat(51),
        })
        .expect(400);

      expect(response.body.message).toContain(
        'slug must be shorter than or equal to 50 characters',
      );
    });

    it('should return 400 with invalid URL', async () => {
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Invalid URL',
          slug: 'invalid-url',
          logoUrl: 'not-a-url',
        })
        .expect(400);

      expect(response.body.message).toContain('logoUrl must be a valid URL');
    });

    it('should return 400 with invalid color format', async () => {
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Invalid Color',
          slug: 'invalid-color',
          primaryColor: 'blue',
        })
        .expect(400);

      expect(
        response.body.message.some((msg: string) =>
          msg.includes('primaryColor must be a valid hex color code'),
        ),
      ).toBe(true);
    });

    it('should return 400 with non-whitelisted field', async () => {
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Extra Field',
          slug: 'extra-field',
          extraField: 'should not be allowed',
        })
        .expect(400);

      expect(response.body.message).toContain(
        'property extraField should not exist',
      );
    });

    it('should return 409 when slug already exists', async () => {
      const createDto = {
        name: 'Duplicate Slug Test',
        slug: 'duplicate-slug-test',
      };

      // Create first business
      const firstResponse = await request(app.getHttpServer())
        .post('/businesses')
        .send(createDto)
        .expect(201);

      createdBusinessIds.push(firstResponse.body.id);

      // Try to create second business with same slug
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send(createDto)
        .expect(409);

      expect(response.body.message).toContain(
        'Business with this slug already exists',
      );
    });
  });

  describe('GET /businesses', () => {
    beforeAll(async () => {
      // Create some test businesses for pagination
      for (let i = 1; i <= 5; i++) {
        const response = await request(app.getHttpServer())
          .post('/businesses')
          .send({
            name: `Pagination Test ${i}`,
            slug: `pagination-test-${i}`,
          })
          .expect(201);
        createdBusinessIds.push(response.body.id);
      }
    });

    it('should return paginated businesses with default values', async () => {
      const response = await request(app.getHttpServer())
        .get('/businesses')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 20);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return correct pagination with page and limit', async () => {
      const response = await request(app.getHttpServer())
        .get('/businesses?page=1&limit=3')
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(3);
      expect(response.body.data.length).toBeLessThanOrEqual(3);
    });

    it('should return 400 with invalid page parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/businesses?page=0')
        .expect(400);

      expect(response.body.message).toContain('page must be at least 1');
    });

    it('should return 400 with invalid limit parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/businesses?limit=101')
        .expect(400);

      expect(response.body.message).toContain('limit must not exceed 100');
    });

    it('should return 400 with non-numeric page parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/businesses?page=abc')
        .expect(400);

      expect(
        response.body.message.some((msg: string) => msg.includes('page')),
      ).toBe(true);
    });
  });

  describe('GET /businesses/:id', () => {
    let testBusinessId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Get By ID Test',
          slug: 'get-by-id-test',
        })
        .expect(201);
      testBusinessId = response.body.id;
      createdBusinessIds.push(testBusinessId);
    });

    it('should return a business by valid ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/businesses/${testBusinessId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testBusinessId);
      expect(response.body).toHaveProperty('name', 'Get By ID Test');
      expect(response.body).toHaveProperty('slug', 'get-by-id-test');
    });

    it('should return 404 for non-existent ID', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';
      const response = await request(app.getHttpServer())
        .get(`/businesses/${nonExistentId}`)
        .expect(404);

      expect(response.body.message).toContain('Business not found');
    });
  });

  describe('PATCH /businesses/:id', () => {
    let testBusinessId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Update Test',
          slug: 'update-test',
        })
        .expect(201);
      testBusinessId = response.body.id;
      createdBusinessIds.push(testBusinessId);
    });

    it('should update a business successfully', async () => {
      const updateDto = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .patch(`/businesses/${testBusinessId}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
      expect(response.body.description).toBe('Updated description');
      expect(response.body.slug).toBe('update-test'); // unchanged
    });

    it('should return 404 when updating non-existent business', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';
      const response = await request(app.getHttpServer())
        .patch(`/businesses/${nonExistentId}`)
        .send({ name: 'New Name' })
        .expect(404);

      expect(response.body.message).toContain('Business not found');
    });

    it('should return 409 when updating to duplicate slug', async () => {
      // Create another business
      const otherResponse = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Other Business',
          slug: 'other-business-slug',
        })
        .expect(201);
      createdBusinessIds.push(otherResponse.body.id);

      // Try to update first business to use the other's slug
      const response = await request(app.getHttpServer())
        .patch(`/businesses/${testBusinessId}`)
        .send({ slug: 'other-business-slug' })
        .expect(409);

      expect(response.body.message).toContain(
        'Business with this slug already exists',
      );
    });
  });

  describe('GET /businesses/by-slug/:slug', () => {
    let activeBusinessSlug: string;
    let inactiveBusinessSlug: string;

    beforeAll(async () => {
      // Create active business
      const activeResponse = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Active Business',
          slug: 'active-business-public',
          description: 'This is active',
          logoUrl: 'https://example.com/logo.png',
          coverImageUrl: 'https://example.com/cover.jpg',
          primaryColor: '#FF5733',
          googleReviewUrl: 'https://g.page/active/review',
          isActive: true,
        })
        .expect(201);
      activeBusinessSlug = activeResponse.body.slug;
      createdBusinessIds.push(activeResponse.body.id);

      // Create inactive business
      const inactiveResponse = await request(app.getHttpServer())
        .post('/businesses')
        .send({
          name: 'Inactive Business',
          slug: 'inactive-business-public',
          isActive: false,
        })
        .expect(201);
      inactiveBusinessSlug = inactiveResponse.body.slug;
      createdBusinessIds.push(inactiveResponse.body.id);
    });

    it('should return public fields for active business', async () => {
      const response = await request(app.getHttpServer())
        .get(`/businesses/by-slug/${activeBusinessSlug}`)
        .expect(200);

      // Should include these fields
      expect(response.body).toHaveProperty('name', 'Active Business');
      expect(response.body).toHaveProperty('slug', activeBusinessSlug);
      expect(response.body).toHaveProperty('description', 'This is active');
      expect(response.body).toHaveProperty(
        'logoUrl',
        'https://example.com/logo.png',
      );
      expect(response.body).toHaveProperty(
        'coverImageUrl',
        'https://example.com/cover.jpg',
      );
      expect(response.body).toHaveProperty('primaryColor', '#FF5733');
      expect(response.body).toHaveProperty(
        'googleReviewUrl',
        'https://g.page/active/review',
      );

      // Should NOT include these internal fields
      expect(response.body).not.toHaveProperty('id');
      expect(response.body).not.toHaveProperty('isActive');
      expect(response.body).not.toHaveProperty('createdAt');
      expect(response.body).not.toHaveProperty('updatedAt');
    });

    it('should return 404 for inactive business', async () => {
      const response = await request(app.getHttpServer())
        .get(`/businesses/by-slug/${inactiveBusinessSlug}`)
        .expect(404);

      expect(response.body.message).toContain('Business not found');
    });

    it('should return 404 for non-existent slug', async () => {
      const response = await request(app.getHttpServer())
        .get('/businesses/by-slug/non-existent-slug-xyz')
        .expect(404);

      expect(response.body.message).toContain('Business not found');
    });
  });
});
