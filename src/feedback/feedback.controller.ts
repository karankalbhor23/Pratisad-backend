import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IpThrottleGuard } from '../common/ip-throttle.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(IpThrottleGuard)
  create(@Body() input: CreateFeedbackDto): Promise<{ id: string }> {
    return this.service.submitPrivate(input);
  }
}
