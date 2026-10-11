import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiUsageService } from './ai-usage.service';
import { BusinessAdminController } from './business-admin.controller';
import { BusinessMembersService } from './business-members.service';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BusinessController, BusinessAdminController],
  providers: [BusinessService, BusinessMembersService, AiUsageService],
  exports: [BusinessService, BusinessMembersService, AiUsageService],
})
export class BusinessModule {}
