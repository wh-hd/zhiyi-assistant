import { IsArray, ArrayMaxSize, IsString, ValidateNested, IsOptional, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChronicDiseaseItem {
  @ApiProperty({ description: '疾病编码', example: 'ICD-11:BA00' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiProperty({ description: '疾病名称', example: '高血压' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: '确诊时间' })
  @IsOptional()
  @IsString()
  diagnosedAt?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateChronicDiseasesDto {
  @ApiProperty({
    description: '慢性病列表（全量替换）。支持简单字符串数组或对象数组。',
    type: [ChronicDiseaseItem],
  })
  @IsArray()
  @ArrayMaxSize(50)
  diseases: (string | ChronicDiseaseItem)[];
}
