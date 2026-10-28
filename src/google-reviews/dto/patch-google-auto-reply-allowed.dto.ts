import { IsBoolean } from 'class-validator';

export class PatchGoogleAutoReplyAllowedDto {
  @IsBoolean()
  allowed!: boolean;
}
