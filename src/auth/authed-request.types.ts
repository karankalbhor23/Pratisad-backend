import { Request } from 'express';

export type ClerkAuthedRequest = Request & {
  clerkUserId?: string;
  clerkEmail?: string;
  platformAdminEmail?: string;
  businessId?: string;
};
