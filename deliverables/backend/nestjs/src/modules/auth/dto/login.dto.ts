import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: '登录标识：邮箱或手机号' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  identifier: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  password: string;
}
