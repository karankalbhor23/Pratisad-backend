import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { AiUsageService } from './ai-usage.service';
import { BusinessMembersService } from './business-members.service';
import { ProvisionPortalUserDto } from './dto/provision-portal-user.dto';
import { ResetPortalCredentialsDto } from './dto/reset-portal-credentials.dto';

@Controller('businesses')
export class BusinessAdminController {
  constructor(
    private readonly members: BusinessMembersService,
    private readonly aiUsage: AiUsageService,
  ) {}

  @Get(':id/portal-user')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  getPortalUser(@Param('id') id: string) {
    return this.members.getPortalUser(id);
  }

  @Post(':id/portal-user/provision')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  provisionPortalUser(
    @Param('id') id: string,
    @Body() body: ProvisionPortalUserDto,
  ) {
    return this.members.provisionPortalUser(id, body.username, body.password);
  }

  @Patch(':id/portal-user/credentials')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  resetCredentials(
    @Param('id') id: string,
    @Body() body: ResetPortalCredentialsDto,
  ) {
    return this.members.resetPortalCredentials(
      id,
      body.password,
      body.username,
    );
  }

  @Delete(':id/portal-user')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  revokePortalUser(@Param('id') id: string) {
    return this.members.revokePortalUser(id);
  }

  @Get(':id/usage')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  getUsage(@Param('id') id: string) {
    return this.aiUsage.getUsageForBusiness(id);
  }
}
