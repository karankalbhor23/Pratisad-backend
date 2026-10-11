import {
  ArrayMaxSize,
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  Matches,
  MaxLength,
  IsBoolean,
  MinLength,
  Length,
} from 'class-validator';
import { IsGoogleReviewUrl } from '../validators/is-google-review-url.validator';

export class CreateBusinessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug must contain only lowercase letters, numbers, and hyphens. No leading, trailing, or consecutive hyphens allowed.',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  localContext?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  keywordsRatingLow?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  keywordsRatingHigh?: string[];

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'logoUrl must be a valid URL' })
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true },
    { message: 'coverImageUrl must be a valid URL' },
  )
  @MaxLength(500)
  coverImageUrl?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message:
      'primaryColor must be a valid hex color code (e.g., #2563EB, #FF5733)',
  })
  primaryColor?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true },
    { message: 'googleReviewUrl must be a valid URL' },
  )
  @IsGoogleReviewUrl()
  @MaxLength(500)
  googleReviewUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/, {
    message:
      'Portal username must be 3–32 characters: letters, numbers, dots, underscores, or hyphens.',
  })
  portalUsername: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  portalPassword: string;
}
