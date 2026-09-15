import {
  Controller, Get, Post, Delete, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationQueryDto } from '../../common/dto/query.dto';
import { IsIn, IsOptional, IsString } from 'class-validator';

class NotificationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsIn(['pending', 'sending', 'sent', 'failed'])
  status?: string;
}

@ApiTags('通知消息')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @ApiOperation({ summary: '获取我的通知列表' })
  async list(@Req() req: any, @Query() query: NotificationQueryDto) {
    return this.service.list(req.user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: '获取未读通知数量' })
  async unreadCount(@Req() req: any) {
    return this.service.unreadCount(req.user.id);
  }

  @Post(':id/read')
  @ApiOperation({ summary: '标记单条通知为已读' })
  async markRead(@Param('id') id: string, @Req() req: any) {
    return this.service.markRead(id, req.user.id);
  }

  @Post('read-all')
  @ApiOperation({ summary: '标记全部通知为已读' })
  async markAllRead(@Req() req: any) {
    return this.service.markAllRead(req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除通知' })
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.id);
  }

  @Post(':id/deliver')
  @ApiOperation({ summary: '（管理员）手动触发微信订阅消息投递 / 重试' })
  async deliver(@Param('id') id: string) {
    return this.service.deliverOne(id);
  }
}
