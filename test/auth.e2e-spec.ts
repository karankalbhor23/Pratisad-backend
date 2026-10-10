import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.E2E_AUTH_BYPASS = 'false';
    process.env.CLERK_SECRET_KEY = 'test-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    process.env.E2E_AUTH_BYPASS = 'true';
    if (app) await app.close();
  }, 30000);

  it('rejects unauthenticated business management requests', async () => {
    await request(app.getHttpServer()).get('/businesses').expect(401);
    await request(app.getHttpServer())
      .post('/businesses')
      .send({ name: 'Test', slug: 'test' })
      .expect(401);
  });

  it('keeps public business lookup available', async () => {
    await request(app.getHttpServer())
      .get('/businesses/by-slug/does-not-exist')
      .expect(404);
  });
});
