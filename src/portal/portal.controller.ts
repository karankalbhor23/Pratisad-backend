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
import type * as Express from 'express';
import { asClerkAuthedRequest } from '../auth/authed-request.types';
import { BusinessUserGuard } from '../auth/business-user.guard';
import { ListPortalFeedbackQueryDto } from './dto/list-portal-feedback-query.dto';
import { PortalService } from './portal.service';

@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('insights')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BusinessUserGuard)
  getInsights(@Req() request: Express.Request) {
    return this.portal.getInsights(asClerkAuthedRequest(request).businessId!);
  }

  @Get('feedback')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BusinessUserGuard)
  listFeedback(
    @Req() request: Express.Request,
    @Query() query: ListPortalFeedbackQueryDto,
  ) {
    return this.portal.listFeedback(asClerkAuthedRequest(request).businessId!, {
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
    @Req() request: Express.Request,
    @Param('id') id: string,
  ): Promise<void> {
    await this.portal.markRead(asClerkAuthedRequest(request).businessId!, id);
  }
}
