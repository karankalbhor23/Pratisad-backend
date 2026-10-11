import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { BusinessUserGuard } from './business-user.guard';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    ClerkAuthGuard,
    PlatformAdminGuard,
    BusinessUserGuard,
    AuthService,
  ],
  exports: [
    ClerkAuthGuard,
    PlatformAdminGuard,
    BusinessUserGuard,
    AuthService,
  ],
})
export class AuthModule {}
