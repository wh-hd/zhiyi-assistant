import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ManualReviewDto {
  @ApiProperty({ description: '成员 ID' })
  @IsString()
  memberId: string;
}
