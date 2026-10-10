import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BusinessController],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessModule {}
