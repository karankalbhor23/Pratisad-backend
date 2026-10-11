import { IsEmail } from 'class-validator';

export class InvitePortalUserDto {
  @IsEmail()
  email: string;
}
