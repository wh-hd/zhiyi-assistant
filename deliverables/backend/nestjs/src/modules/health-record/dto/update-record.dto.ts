import { IsString, IsOptional, IsNumber, IsDateString, IsArray, MaxLength, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateHealthRecordDto {
  @ApiPropertyOptional({ description: '血型', example: 'A' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  bloodType?: string;

  @ApiPropertyOptional({ description: '身高 (cm)', minimum: 30, maximum: 250 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(250)
  heightCm?: number;

  @ApiPropertyOptional({ description: '体重 (kg)', minimum: 2, maximum: 300 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  @Max(300)
  weightKg?: number;

  @ApiPropertyOptional({ description: '最近体检日期' })
  @IsOptional()
  @IsDateString()
  lastCheckupDate?: string;

  @ApiPropertyOptional({ description: '体检摘要', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  checkupSummary?: string;

  @ApiPropertyOptional({ description: '手术史列表（全量替换）', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  surgeries?: string[];

  @ApiPropertyOptional({ description: '家族史列表（全量替换）', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  familyHistory?: string[];

  @ApiPropertyOptional({ description: '疫苗接种史列表（全量替换）', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vaccinations?: string[];
}
