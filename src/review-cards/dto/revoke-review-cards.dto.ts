import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class RevokeReviewCardsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tokens: string[];
}
