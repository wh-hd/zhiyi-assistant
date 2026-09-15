import { IsIn, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MarkAdherenceDto {
  @ApiProperty({ description: '服药状态', enum: ['taken', 'missed', 'skipped'] })
  @IsIn(['taken', 'missed', 'skipped'])
  status: string;

  @ApiPropertyOptional({ description: '计划服药时间 (ISO)，不填则取当前时间', example: '2026-07-09T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
