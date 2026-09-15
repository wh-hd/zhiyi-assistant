import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: '登录时签发的 refresh token（JWT，由服务端签名）' })
  @IsString()
  refreshToken: string;
}
