import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { GoogleReviewProcessingState } from '@prisma/client';
import { asClerkAuthedRequest } from '../auth/authed-request.types';
import { BusinessUserGuard } from '../auth/business-user.guard';
import {
  ApproveGoogleReviewDto,
  SetGoogleLocationDto,
  UpdateGoogleAutoReplySettingsDto,
} from './dto/portal-google-reviews.dto';
import { GoogleReviewsRateLimitService } from './google-reviews-rate-limit.service';
import { GoogleReviewsService } from './google-reviews.service';

@Controller('portal/google-reviews')
export class GoogleReviewsPortalController {
  constructor(
    private readonly googleReviews: GoogleReviewsService,
    private readonly rateLimit: GoogleReviewsRateLimitService,
  ) {}

  @Get('status')
  @UseGuards(BusinessUserGuard)
  getStatus(@Req() request: Request) {
    const businessId = asClerkAuthedRequest(request).businessId!;
    return this.googleReviews.getStatus(businessId);
  }

  @Get('oauth/start')
  @UseGuards(BusinessUserGuard)
  async startOAuth(@Req() request: Request) {
    const authed = asClerkAuthedRequest(request);
    const businessId = authed.businessId!;
    const clerkUserId = authed.clerkUserId!;
    this.rateLimit.assertOAuthStartAllowed(businessId);
    return this.googleReviews.startOAuth(businessId, clerkUserId);
  }

  @Get('locations')
  @UseGuards(BusinessUserGuard)
  listLocations(@Req() request: Request) {
    const businessId = asClerkAuthedRequest(request).businessId!;
    return this.googleReviews.listLocations(businessId);
  }

  @Put('location')
  @UseGuards(BusinessUserGuard)
  setLocation(@Req() request: Request, @Body() body: SetGoogleLocationDto) {
    const businessId = asClerkAuthedRequest(request).businessId!;
    return this.googleReviews.setLocation(
      businessId,
      body.locationName,
      body.locationTitle ?? body.locationName,
    );
  }

  @Put('settings')
  @UseGuards(BusinessUserGuard)
  updateSettings(
    @Req() request: Request,
    @Body() body: UpdateGoogleAutoReplySettingsDto,
  ) {
    const businessId = asClerkAuthedRequest(request).businessId!;
    return this.googleReviews.updateSettings(businessId, body.enabled);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BusinessUserGuard)
  sync(@Req() request: Request) {
    const businessId = asClerkAuthedRequest(request).businessId!;
    this.rateLimit.assertManualSyncAllowed(businessId);
    return this.googleReviews.syncBusinessReviews(businessId);
  }

  @Get()
  @UseGuards(BusinessUserGuard)
  listReviews(
    @Req() request: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('state') state?: string,
  ) {
    const businessId = asClerkAuthedRequest(request).businessId!;
    const parsedState = state as GoogleReviewProcessingState | undefined;
    return this.googleReviews.listReviews(businessId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      state: parsedState,
    });
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BusinessUserGuard)
  approve(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: ApproveGoogleReviewDto,
  ) {
    const businessId = asClerkAuthedRequest(request).businessId!;
    return this.googleReviews.approveReview(businessId, id, body.replyText ?? '');
  }

  @Post(':id/regenerate-draft')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BusinessUserGuard)
  regenerate(@Req() request: Request, @Param('id') id: string) {
    const businessId = asClerkAuthedRequest(request).businessId!;
    return this.googleReviews.regenerateDraft(businessId, id);
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BusinessUserGuard)
  dismiss(@Req() request: Request, @Param('id') id: string) {
    const businessId = asClerkAuthedRequest(request).businessId!;
    return this.googleReviews.dismissReview(businessId, id);
  }

  @Delete('connection')
  @HttpCode(HttpStatus.OK)
  @UseGuards(BusinessUserGuard)
  disconnect(@Req() request: Request) {
    const businessId = asClerkAuthedRequest(request).businessId!;
    return this.googleReviews.disconnect(businessId);
  }
}
