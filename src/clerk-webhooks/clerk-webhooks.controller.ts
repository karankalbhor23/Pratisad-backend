import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Webhook } from 'standardwebhooks';
import { BusinessMembersService } from '../business/business-members.service';

type ClerkWebhookEvent = {
  type: string;
  data: {
    id?: string;
    username?: string | null;
    email_addresses?: Array<{ email_address: string; id?: string }>;
    primary_email_address_id?: string;
    public_metadata?: Record<string, unknown>;
  };
};

@Controller('webhooks/clerk')
export class ClerkWebhooksController {
  constructor(
    private readonly config: ConfigService,
    private readonly members: BusinessMembersService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ): Promise<{ ok: true }> {
    const secret = this.config.get<string>('CLERK_WEBHOOK_SIGNING_SECRET');
    if (!secret) throw new UnauthorizedException('Webhook not configured');

    const payload = request.rawBody
      ? request.rawBody.toString('utf8')
      : JSON.stringify(request.body);
    const wh = new Webhook(secret);
    let event: ClerkWebhookEvent;
    try {
      event = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent;
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (event.type === 'user.created') {
      const userId = event.data.id;
      const emails = event.data.email_addresses ?? [];
      const primaryId = event.data.primary_email_address_id;
      const primary =
        emails.find(
          (entry) =>
            entry.email_address &&
            (entry as { id?: string }).id === primaryId,
        )?.email_address ?? emails[0]?.email_address;
      const metadata = event.data.public_metadata ?? {};
      const businessId =
        typeof metadata.businessId === 'string' ? metadata.businessId : undefined;
      const username = event.data.username ?? undefined;
      if (userId && (primary || username)) {
        await this.members.activateFromClerkUser(
          primary ?? null,
          userId,
          businessId,
          username,
        );
      }
    }

    return { ok: true };
  }
}
