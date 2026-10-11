import { Business, BusinessMemberStatus } from '@prisma/client';

// Full business response (for management endpoints)
export type BusinessResponseDto = Business;

export type BusinessListItemDto = Business & {
  aiDraftCountMonth: number;
  portalUserStatus: 'none' | BusinessMemberStatus;
};

// Public business response (for customer-facing pages)
export interface PublicBusinessResponseDto {
  name: string;
  slug: string;
  description: string | null;
  keywordsRatingLow: string[];
  keywordsRatingHigh: string[];
  logoUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string | null;
  googleReviewUrl: string | null;
}

// Paginated list response
export interface PaginatedBusinessResponseDto {
  data: BusinessListItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
