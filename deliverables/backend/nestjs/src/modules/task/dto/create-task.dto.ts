import {
  IsString, IsOptional, IsBoolean, IsDateString, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({ description: '家庭ID' })
  @IsString()
  familyId: string;

  @ApiPropertyOptional({ description: '关联家庭成员ID' })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiProperty({ description: '任务标题', example: '提醒爸爸测血压' })
  @IsString()
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ description: '任务备注/详情' })
  @IsOptional()
  @IsString()
  detail?: string;

  @ApiPropertyOptional({ description: '图标 key 或 svg path' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '图标背景色' })
  @IsOptional()
  @IsString()
  iconBg?: string;

  @ApiPropertyOptional({ description: '图标描边色' })
  @IsOptional()
  @IsString()
  iconStroke?: string;

  @ApiPropertyOptional({ description: '是否已完成', example: false })
  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @ApiPropertyOptional({ description: '截止日期 (ISO)', example: '2026-08-01T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: '排序权重', example: 0 })
  @IsOptional()
  sortOrder?: number;
}
