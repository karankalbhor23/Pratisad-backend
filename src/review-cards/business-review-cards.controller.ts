import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { AssignReviewCardsDto } from './dto/assign-review-cards.dto';
import { RevokeReviewCardsDto } from './dto/revoke-review-cards.dto';
import { ReviewCardsService } from './review-cards.service';

@Controller('businesses/:businessId/review-cards')
@UseGuards(PlatformAdminGuard)
export class BusinessReviewCardsController {
  constructor(private readonly reviewCards: ReviewCardsService) {}

  @Get('inventory-summary')
  @HttpCode(HttpStatus.OK)
  inventorySummary() {
    return this.reviewCards.inventorySummary();
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Param('businessId') businessId: string) {
    return this.reviewCards.listAssignedForBusiness(businessId);
  }

  @Post('assign')
  @HttpCode(HttpStatus.OK)
  assign(
    @Param('businessId') businessId: string,
    @Body() body: AssignReviewCardsDto,
  ) {
    return this.reviewCards.assignToBusiness(businessId, body);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  revoke(
    @Param('businessId') businessId: string,
    @Body() body: RevokeReviewCardsDto,
  ) {
    return this.reviewCards.revokeFromBusiness(businessId, body.tokens);
  }
}
