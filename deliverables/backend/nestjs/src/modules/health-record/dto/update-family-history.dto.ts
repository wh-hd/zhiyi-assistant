import { IsArray, ArrayMaxSize, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 家族史更新 DTO（全量替换）
 */
export class UpdateFamilyHistoryDto {
  @ApiProperty({
    description: '家族史列表（全量替换）',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  familyHistory: string[];
}
