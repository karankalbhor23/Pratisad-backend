import { Request } from 'express';

export type ClerkAuthedRequest = Request & {
  clerkUserId?: string;
  clerkEmail?: string;
  clerkUsername?: string;
  platformAdminEmail?: string;
  businessId?: string;
};

export function asClerkAuthedRequest(request: Request): ClerkAuthedRequest {
  return request as ClerkAuthedRequest;
}
