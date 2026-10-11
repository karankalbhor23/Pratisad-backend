import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ProvisionPortalUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/, {
    message:
      'Username must be 3–32 characters: letters, numbers, dots, underscores, or hyphens.',
  })
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
