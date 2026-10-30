import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFeedbackDto {
  @IsOptional()
  @IsUUID('4')
  submissionId?: string;

  @IsString()
  @Length(2, 50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  businessSlug: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  keywords: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
