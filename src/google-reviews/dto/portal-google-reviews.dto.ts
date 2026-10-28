import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsString()
  state?: string;
}
