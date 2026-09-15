import {
  Controller, Get, Post, Param, Query, Body, UseGuards, Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('健康报告')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly service: ReportService) {}

  @Get()
  @ApiOperation({ summary: '获取成员健康报告列表' })
  async list(
    @Req() req: any,
    @Query('memberId') memberId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!memberId) throw new BadRequestException('memberId is required');
    return this.service.list(memberId, req.user.id, page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Post('generate')
  @ApiOperation({ summary: '生成健康报告 (聚合档案/自评/指标/用药)' })
  async generate(@Req() req: any, @Body() dto: GenerateReportDto) {
    return this.service.generate(dto, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取报告详情' })
  async getById(@Param('id') id: string, @Req() req: any) {
    return this.service.getById(id, req.user.id);
  }
}
