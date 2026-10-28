import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { GoogleReviewsService } from './google-reviews.service';

@Injectable()
export class GoogleReviewsCronService {
  private readonly logger = new Logger(GoogleReviewsCronService.name);

  constructor(
    private readonly googleReviews: GoogleReviewsService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleDailySync(): Promise<void> {
    if (this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID')?.trim()) {
      this.logger.log('Starting scheduled Google reviews sync');
      await this.googleReviews.runScheduledSync();
      this.logger.log('Finished scheduled Google reviews sync');
    }
  }
}
