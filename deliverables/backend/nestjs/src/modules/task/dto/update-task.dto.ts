import {
  IsOptional, IsString, IsBoolean, IsDateString, MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTaskDto {
  @ApiPropertyOptional({ description: '关联家庭成员ID' })
  @IsOptional()
  @IsString()
  memberId?: string | null;

  @ApiPropertyOptional({ description: '任务标题' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

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

  @ApiPropertyOptional({ description: '是否已完成' })
  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @ApiPropertyOptional({ description: '截止日期 (ISO)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  sortOrder?: number;
}
