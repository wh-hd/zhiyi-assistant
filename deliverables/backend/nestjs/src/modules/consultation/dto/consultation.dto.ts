import { IsInt, IsString, IsOptional, IsIn, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartConsultationDto {
  @ApiProperty({ description: '咨询问题文本', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  query: string;

  @ApiProperty({ description: '家庭 ID' })
  @IsString()
  familyId: string;

  @ApiProperty({ description: '成员 ID' })
  @IsString()
  memberId: string;

  @ApiPropertyOptional({ description: '输入类型', enum: ['text', 'voice'] })
  @IsOptional()
  @IsIn(['text', 'voice'])
  inputType?: string;

  @ApiPropertyOptional({ description: '会话 ID（继续已有对话时传入）' })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class RedlineCheckDto {
  @ApiProperty({ description: '待检测文本', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  query: string;

  @ApiPropertyOptional({ description: '成员 ID（用于获取年龄/性别上下文）' })
  @IsOptional()
  @IsString()
  memberId?: string;
}

export class FeedbackDto {
  @ApiProperty({ description: '满意度评分 (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  satisfaction: number;

  @ApiPropertyOptional({ description: '反馈文本', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  feedbackText?: string;
}
