import { IsArray, ArrayMaxSize, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 疫苗接种史更新 DTO（全量替换）
 */
export class UpdateVaccinationsDto {
  @ApiProperty({
    description: '疫苗接种史列表（全量替换）',
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  vaccinations: string[];
}
