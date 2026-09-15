import {
  ArrayMinSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetricItemDto {
  @ApiProperty({ description: '指标类型', example: 'blood_pressure_systolic' })
  @IsString()
  metricType: string;

  @ApiProperty({ description: '数值', example: 128 })
  @IsNumber()
  value: number;

  @ApiProperty({ description: '单位', example: 'mmHg' })
  @IsString()
  unit: string;

  @ApiPropertyOptional({ description: '记录时间 (ISO)，默认当前', example: '2026-07-09T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: '录入方式', enum: ['manual', 'device', 'ocr'], example: 'manual' })
  @IsOptional()
  @IsString()
  @IsIn(['manual', 'device', 'ocr'])
  inputMethod?: string;

  @ApiPropertyOptional({ description: '设备ID' })
  @IsOptional()
  @IsString()
  deviceId?: string;

}

export class RecordMetricDto {
  @ApiProperty({ description: '家庭成员ID' })
  @IsString()
  memberId: string;

  @ApiProperty({ description: '指标类型', example: 'blood_pressure_systolic' })
  @IsString()
  metricType: string;

  @ApiProperty({ description: '数值', example: 128 })
  @IsNumber()
  value: number;

  @ApiProperty({ description: '单位', example: 'mmHg' })
  @IsString()
  unit: string;

  @ApiPropertyOptional({ description: '记录时间 (ISO)', example: '2026-07-09T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: '录入方式', enum: ['manual', 'device', 'ocr'], example: 'manual' })
  @IsOptional()
  @IsString()
  @IsIn(['manual', 'device', 'ocr'])
  inputMethod?: string;

  @ApiPropertyOptional({ description: '设备ID' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: '分组ID' })
  @IsOptional()
  @IsString()
  groupId?: string;
}

export class BatchRecordMetricDto {
  @ApiProperty({ description: '家庭成员ID' })
  @IsString()
  memberId: string;

  @ApiProperty({ description: '指标列表', type: [MetricItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MetricItemDto)
  metrics: MetricItemDto[];

  @ApiPropertyOptional({ description: '分组ID (批量同组)' })
  @IsOptional()
  @IsString()
  groupId?: string;
}

export class UpdateThresholdDto {
  @ApiPropertyOptional({ description: '正常下限' })
  @IsOptional()
  @IsNumber()
  minNormal?: number;

  @ApiPropertyOptional({ description: '正常上限' })
  @IsOptional()
  @IsNumber()
  maxNormal?: number;

  @ApiPropertyOptional({ description: '连续异常触发告警次数', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  alertConsecutiveCount?: number;
}
