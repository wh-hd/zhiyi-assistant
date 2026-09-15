import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('用户')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息' })
  getProfile(@Req() req) {
    return this.userService.getProfile(req.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: '更新个人信息' })
  updateProfile(@Req() req, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(req.user.id, dto);
  }

  @Get('me/families')
  @ApiOperation({ summary: '我的家庭列表' })
  getFamilies(@Req() req) {
    return this.userService.getFamilies(req.user.id);
  }

  @Get('me/stats')
  @ApiOperation({ summary: '我的家庭健康统计' })
  getStats(@Req() req) {
    return this.userService.getStats(req.user.id);
  }
}
