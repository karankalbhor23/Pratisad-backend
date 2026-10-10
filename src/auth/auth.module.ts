import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { PlatformAdminGuard } from './platform-admin.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [PlatformAdminGuard],
  exports: [PlatformAdminGuard],
})
export class AuthModule {}
