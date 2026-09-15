import {
  IsOptional, IsString, IsIn, IsArray, IsDateString,
  ValidateNested, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MedicationScheduleItemDto } from './create-medication.dto';

export class UpdateMedicationDto {
  @ApiPropertyOptional({ description: '药品名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  medicineName?: string;

  @ApiPropertyOptional({ description: '药品编码' })
  @IsOptional()
  @IsString()
  medicineCode?: string;

  @ApiPropertyOptional({ description: '剂量' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({ description: '剂量单位' })
  @IsOptional()
  @IsString()
  dosageUnit?: string;

  @ApiPropertyOptional({ description: '服药频率', enum: ['daily', 'twice_daily', 'three_times', 'every_8h', 'custom'] })
  @IsOptional()
  @IsIn(['daily', 'twice_daily', 'three_times', 'every_8h', 'custom'])
  frequency?: string;

  @ApiPropertyOptional({ description: '自定义服药计划', type: [MedicationScheduleItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationScheduleItemDto)
  customSchedule?: MedicationScheduleItemDto[];

  @ApiPropertyOptional({ description: '开始日期 (ISO)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期 (ISO)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  notes?: string;
}
