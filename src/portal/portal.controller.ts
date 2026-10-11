import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BusinessUserGuard } from '../auth/business-user.guard';
import { ClerkAuthedRequest } from '../auth/authed-request.types';
import { ListPortalFeedbackQueryDto } from './dto/list-portal-feedback-query.dto';
import { PortalService } from './portal.service';

@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('insights')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BusinessUserGuard)
  getInsights(@Req() request: ClerkAuthedRequest) {
    return this.portal.getInsights(request.businessId!);
  }

  @Get('feedback')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BusinessUserGuard)
  listFeedback(
    @Req() request: ClerkAuthedRequest,
    @Query() query: ListPortalFeedbackQueryDto,
  ) {
    return this.portal.listFeedback(request.businessId!, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      privateOnly: query.privateOnly,
      unreadOnly: query.unreadOnly,
    });
  }

  @Patch('feedback/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(BusinessUserGuard)
  async markRead(
    @Req() request: ClerkAuthedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.portal.markRead(request.businessId!, id);
  }
}
