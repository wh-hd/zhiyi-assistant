import {
  IsString, IsOptional, IsIn, IsArray, IsDateString,
  ValidateNested, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MedicationScheduleItemDto {
  @ApiProperty({ description: '计划服药时间 HH:mm', example: '08:00' })
  @IsString()
  time: string;

  @ApiPropertyOptional({ description: '剂量', example: '1片' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({ description: '备注', example: '饭后' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateMedicationDto {
  @ApiProperty({ description: '家庭成员ID' })
  @IsString()
  memberId: string;

  @ApiProperty({ description: '药品名称', example: '缬沙坦' })
  @IsString()
  @MaxLength(100)
  medicineName: string;

  @ApiPropertyOptional({ description: '药品编码 (如 ATC)', example: 'C09CA03' })
  @IsOptional()
  @IsString()
  medicineCode?: string;

  @ApiPropertyOptional({ description: '剂量', example: '80mg' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({ description: '剂量单位', example: '片' })
  @IsOptional()
  @IsString()
  dosageUnit?: string;

  @ApiProperty({ description: '服药频率', enum: ['daily', 'twice_daily', 'three_times', 'every_8h', 'custom'] })
  @IsIn(['daily', 'twice_daily', 'three_times', 'every_8h', 'custom'])
  frequency: string;

  @ApiPropertyOptional({ description: '自定义服药计划', type: [MedicationScheduleItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationScheduleItemDto)
  customSchedule?: MedicationScheduleItemDto[];

  @ApiProperty({ description: '开始日期 (ISO)', example: '2026-01-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: '结束日期 (ISO)', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '数据来源', enum: ['manual', 'ocr'], example: 'manual' })
  @IsOptional()
  @IsIn(['manual', 'ocr'])
  source?: string;

  @ApiPropertyOptional({ description: 'OCR 图片 URL (source=ocr 时)' })
  @IsOptional()
  @IsString()
  ocrImageUrl?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  notes?: string;
}
