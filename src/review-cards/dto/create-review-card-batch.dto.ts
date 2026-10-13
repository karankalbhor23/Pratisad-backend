import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateReviewCardBatchDto {
  @IsString()
  @MinLength(1)
  label: string;

  @IsInt()
  @Min(1)
  @Max(500)
  quantity: number;
}
