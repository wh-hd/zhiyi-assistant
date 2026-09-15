import { IsArray, ArrayMaxSize, ValidateNested, IsString, IsOptional, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AllergyItem {
  @ApiProperty({ description: '过敏原名称', example: '青霉素' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: '过敏反应描述' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reaction?: string;

  @ApiPropertyOptional({ description: '严重程度: mild/moderate/severe', enum: ['mild', 'moderate', 'severe'] })
  @IsOptional()
  @IsString()
  severity?: string;
}

export class UpdateAllergiesDto {
  @ApiProperty({
    description: '过敏原列表（全量替换）',
    type: [AllergyItem],
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AllergyItem)
  allergies: AllergyItem[];
}
