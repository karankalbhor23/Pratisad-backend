import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateReviewDraftDto } from './dto/create-review-draft.dto';
import { IpThrottleGuard } from '../common/ip-throttle.guard';
import { ReviewDraftsService } from './review-drafts.service';

@Controller('review-drafts')
export class ReviewDraftsController {
  constructor(private readonly service: ReviewDraftsService) {}
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(IpThrottleGuard)
  create(@Body() input: CreateReviewDraftDto): Promise<{ draft: string }> {
    return this.service.create(input);
  }
}
