import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

export interface HealthCheckResponse {
  status: string;
  service: string;
}

@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check(): HealthCheckResponse {
    return {
      status: 'ok',
      service: 'pratisad-api',
    };
  }
}
