import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  Matches,
  MaxLength,
  IsBoolean,
  MinLength,
} from 'class-validator';

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
  @MaxLength(500)
  googleReviewUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
