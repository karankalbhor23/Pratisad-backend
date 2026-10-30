import { Type } from 'class-transformer';
import { GoogleReviewProcessingState } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SetGoogleLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  locationName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationTitle?: string;
}

export class UpdateGoogleAutoReplySettingsDto {
  @IsBoolean()
  enabled!: boolean;
}

export class ApproveGoogleReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(3500)
  replyText?: string;
}

export class ListGoogleReviewsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(GoogleReviewProcessingState)
  state?: GoogleReviewProcessingState;
}
