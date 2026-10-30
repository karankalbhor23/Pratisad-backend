import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthCheckResponse {
  status: string;
  service: string;
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(): Promise<HealthCheckResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', service: 'pratisad-api' };
    } catch {
      throw new ServiceUnavailableException('Database is unavailable.');
    }
  }
}
