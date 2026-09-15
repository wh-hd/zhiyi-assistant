import {
  Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MetricService } from './metric.service';
import {
  RecordMetricDto, BatchRecordMetricDto, UpdateThresholdDto,
} from './dto/metric.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { DateRangeQueryDto, DaysQueryDto } from '../../common/dto/query.dto';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

class MetricListQueryDto extends DateRangeQueryDto {
  @IsString()
  memberId: string;

  @IsOptional()
  @IsString()
  type?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 100;
}

class MetricTrendQueryDto extends DaysQueryDto {
  @IsString()
  memberId: string;

  @IsString()
  type: string;
}

@ApiTags('健康指标')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('metrics')
export class MetricController {
  constructor(private readonly service: MetricService) {}

  @Get()
  @ApiOperation({ summary: '查询健康指标记录' })
  async list(@Req() req: any, @Query() query: MetricListQueryDto) {
    return this.service.list(query.memberId, req.user.id, query);
  }

  @Post()
  @ApiOperation({ summary: '记录单条健康指标' })
  async record(@Req() req: any, @Body() dto: RecordMetricDto) {
    return this.service.record(dto, req.user.id);
  }

  @Post('batch')
  @ApiOperation({ summary: '批量记录健康指标 (如血压包含收缩压/舒张压)' })
  async recordBatch(@Req() req: any, @Body() dto: BatchRecordMetricDto) {
    return this.service.recordBatch(dto, req.user.id);
  }

  @Get('trend')
  @ApiOperation({ summary: '获取指标趋势与阈值评估' })
  async trend(@Req() req: any, @Query() query: MetricTrendQueryDto) {
    return this.service.getTrend(query.memberId, req.user.id, query.type, query.days);
  }

  @Get('thresholds')
  @ApiOperation({ summary: '获取指标阈值配置' })
  async thresholds() {
    return this.service.getThresholds();
  }

  @Patch('thresholds/:metricType')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: '更新指标阈值配置（仅管理员）' })
  async updateThreshold(
    @Param('metricType') metricType: string,
    @Body() dto: UpdateThresholdDto,
  ) {
    return this.service.updateThreshold(metricType, dto);
  }
}
