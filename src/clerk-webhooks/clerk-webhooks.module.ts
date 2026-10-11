import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module';
import { ClerkWebhooksController } from './clerk-webhooks.controller';

@Module({
  imports: [BusinessModule],
  controllers: [ClerkWebhooksController],
})
export class ClerkWebhooksModule {}
