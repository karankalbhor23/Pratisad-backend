import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

export class AssignReviewCardsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tokens?: string[];

  @ValidateIf((o: AssignReviewCardsDto) => !o.tokens?.length)
  @IsUUID()
  batchId?: string;

  @ValidateIf((o: AssignReviewCardsDto) => !o.tokens?.length)
  @IsInt()
  @Min(1)
  count?: number;
}
