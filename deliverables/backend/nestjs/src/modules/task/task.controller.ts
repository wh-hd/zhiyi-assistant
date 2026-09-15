import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Req, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('待办事项')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TaskController {
  constructor(private readonly service: TaskService) {}

  @Get()
  @ApiOperation({ summary: '获取家庭待办事项列表（可按完成状态过滤）' })
  async list(@Req() req: any, @Query('familyId') familyId: string, @Query('done') done?: string) {
    if (!familyId) throw new BadRequestException('familyId is required');
    return this.service.list(familyId, req.user.id, done);
  }

  @Post()
  @ApiOperation({ summary: '新建待办事项' })
  async create(@Req() req: any, @Body() dto: CreateTaskDto) {
    return this.service.create(dto, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新待办事项（编辑内容 / 切换完成状态）' })
  async update(@Param('id') id: string, @Req() req: any, @Body() dto: UpdateTaskDto) {
    return this.service.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除待办事项' })
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.id);
  }
}
