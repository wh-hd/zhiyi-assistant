import { IsString, MaxLength, IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddMemberDto {
  @ApiProperty({ description: '成员昵称', example: '晓琳', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  nickname: string;

  @ApiPropertyOptional({ description: '与创建者的关系', enum: ['self', 'spouse', 'child', 'parent', 'grandparent', 'other'] })
  @IsOptional()
  @IsIn(['self', 'spouse', 'child', 'parent', 'grandparent', 'other'])
  relation?: string;

  @ApiPropertyOptional({ description: '年龄', minimum: 0, maximum: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  age?: number;

  @ApiPropertyOptional({ description: '性别: 0未知 1男 2女', enum: [0, 1, 2] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1, 2])
  gender?: number;

  @ApiPropertyOptional({ description: '关联注册用户ID (未注册成员留空)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: '家庭角色', enum: ['admin', 'caregiver', 'member'], default: 'member' })
  @IsOptional()
  @IsIn(['admin', 'caregiver', 'member'])
  role?: string;

  @ApiPropertyOptional({ description: '头像 URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
