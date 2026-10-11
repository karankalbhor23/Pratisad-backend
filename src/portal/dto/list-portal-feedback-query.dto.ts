import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export class ListPortalFeedbackQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  @IsOptional()
  privateOnly?: boolean;

  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  @IsOptional()
  unreadOnly?: boolean;
}
