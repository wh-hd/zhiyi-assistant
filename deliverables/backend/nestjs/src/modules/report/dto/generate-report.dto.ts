import { IsString, IsOptional, IsIn, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateReportDto {
  @ApiProperty({ description: '家庭成员ID' })
  @IsString()
  memberId: string;

  @ApiPropertyOptional({ description: '报告类型', enum: ['periodic', 'annual', 'condition', 'consult_summary'], example: 'periodic' })
  @IsOptional()
  @IsIn(['periodic', 'annual', 'condition', 'consult_summary'])
  type?: string;

  @ApiPropertyOptional({ description: '报告标题', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ description: '统计开始日期 (ISO)', example: '2026-06-09' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ description: '统计结束日期 (ISO)', example: '2026-07-09' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
