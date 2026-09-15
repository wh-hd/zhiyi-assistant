import { IsString, MaxLength, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMemberDto {
  @ApiPropertyOptional({ description: '成员昵称', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickname?: string;

  @ApiPropertyOptional({ description: '关系', enum: ['self', 'spouse', 'child', 'parent', 'grandparent', 'other'] })
  @IsOptional()
  @IsIn(['self', 'spouse', 'child', 'parent', 'grandparent', 'other'])
  relation?: string;

  @ApiPropertyOptional({ description: '年龄', minimum: 0, maximum: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(150)
  age?: number;

  @ApiPropertyOptional({ description: '性别: 0未知 1男 2女', enum: [0, 1, 2] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1, 2])
  gender?: number;

  @ApiPropertyOptional({ description: '头像 URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: '成员角色', enum: ['admin', 'caregiver', 'member'] })
  @IsOptional()
  @IsIn(['admin', 'caregiver', 'member'])
  role?: string;

  @ApiPropertyOptional({ description: '排序序号' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
