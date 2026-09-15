import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MedicationService } from './medication.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { MarkAdherenceDto } from './dto/mark-adherence.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('用药管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('medications')
export class MedicationController {
  constructor(private readonly service: MedicationService) {}

  @Get()
  @ApiOperation({ summary: '获取成员用药计划列表' })
  async list(@Req() req: any, @Query('memberId') memberId: string, @Query('isActive') isActive?: string) {
    if (!memberId) throw new BadRequestException('memberId is required');
    const active = isActive === undefined ? undefined : isActive === 'true';
    return this.service.list(memberId, req.user.id, active);
  }

  @Post()
  @ApiOperation({ summary: '创建用药计划' })
  async create(@Req() req: any, @Body() dto: CreateMedicationDto) {
    return this.service.create(dto, req.user.id);
  }

  @Get('today')
  @ApiOperation({ summary: '获取今日服药提醒' })
  async today(@Req() req: any, @Query('memberId') memberId: string) {
    if (!memberId) throw new BadRequestException('memberId is required');
    return this.service.getTodayReminders(memberId, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取用药计划详情' })
  async getById(@Param('id') id: string, @Req() req: any) {
    return this.service.getById(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新用药计划' })
  async update(@Param('id') id: string, @Req() req: any, @Body() dto: UpdateMedicationDto) {
    return this.service.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '停用用药计划 (软删除)' })
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.id);
  }

  @Post(':id/adherence')
  @ApiOperation({ summary: '标记服药状态 (已服/漏服/跳过)' })
  async markAdherence(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: MarkAdherenceDto,
  ) {
    return this.service.markAdherence(id, dto, req.user.id);
  }

  @Get(':id/adherences')
  @ApiOperation({ summary: '获取用药依从记录' })
  async adherences(
    @Param('id') id: string,
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getAdherences(id, req.user.id, from, to);
  }
}
