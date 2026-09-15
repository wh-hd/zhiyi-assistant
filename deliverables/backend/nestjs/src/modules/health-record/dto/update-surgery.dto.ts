import { IsArray, ArrayMaxSize, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 手术史更新 DTO（全量替换）
 */
export class UpdateSurgeriesDto {
  @ApiProperty({
    description: '手术史列表（全量替换）',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  surgeries: string[];
}
