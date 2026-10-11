import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { AiUsageService } from './ai-usage.service';
import { BusinessMembersService } from './business-members.service';
import { InvitePortalUserDto } from './dto/invite-portal-user.dto';

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

  @Post(':id/portal-user/invite')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  invitePortalUser(
    @Param('id') id: string,
    @Body() body: InvitePortalUserDto,
  ) {
    return this.members.invitePortalUser(id, body.email);
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
