import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
