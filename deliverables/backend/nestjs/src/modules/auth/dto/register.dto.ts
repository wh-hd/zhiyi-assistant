import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: '邮箱，作为登录账号，全站唯一' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '密码，至少 8 位' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @ApiProperty({ description: '昵称（可选）', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  nickname?: string;

  @ApiProperty({ description: '手机号（可选）', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
