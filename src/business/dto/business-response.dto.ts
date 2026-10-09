import { Business } from '@prisma/client';

// Full business response (for management endpoints)
export type BusinessResponseDto = Business;

// Public business response (for customer-facing pages)
export interface PublicBusinessResponseDto {
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string | null;
  googleReviewUrl: string | null;
}

// Paginated list response
export interface PaginatedBusinessResponseDto {
  data: BusinessResponseDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
