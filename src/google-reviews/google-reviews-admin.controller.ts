import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';
import { PatchGoogleAutoReplyAllowedDto } from './dto/patch-google-auto-reply-allowed.dto';
import { GoogleReviewsService } from './google-reviews.service';

@Controller('businesses')
export class GoogleReviewsAdminController {
  constructor(private readonly googleReviews: GoogleReviewsService) {}

  @Patch(':id/google-auto-reply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  setAllowed(
    @Param('id') id: string,
    @Body() body: PatchGoogleAutoReplyAllowedDto,
  ) {
    return this.googleReviews.setAllowedByAdmin(id, body.allowed);
  }
}
