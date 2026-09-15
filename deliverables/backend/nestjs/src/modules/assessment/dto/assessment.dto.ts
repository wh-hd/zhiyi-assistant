import { Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartAssessmentDto {
  @ApiProperty({ description: '成员 ID' })
  @IsString()
  memberId: string;

  @ApiProperty({ description: '自评类型: initial/review/manual', enum: ['initial', 'review', 'manual'] })
  @IsIn(['initial', 'review', 'manual'])
  type: 'initial' | 'review' | 'manual';

  @ApiProperty({ description: '随机抽取题数（默认 10，范围 6-20）', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(6)
  @Max(20)
  questionCount?: number;
}

export class SubmitAnswerDto {
  @ApiProperty({ description: '会话 ID (start 时返回)' })
  @IsString()
  sessionId: string;

  @ApiProperty({ description: '当前步骤序号' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  step: number;

  @ApiProperty({
    description: '按题目 ID 键入的答案映射（如 {"q1": 2, "q2": 3}），多选题值为数组',
  })
  @IsObject()
  answers: Record<string, unknown>;
}

export class AssessmentHistoryQueryDto {
  @IsString()
  memberId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10;
}
