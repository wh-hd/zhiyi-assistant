import {
  Controller, Get, Post, Param, Body, Query, Res, Req, UseGuards, BadRequestException, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ConsultationService } from './consultation.service';
import { StartConsultationDto, RedlineCheckDto, FeedbackDto } from './dto/consultation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('AI健康咨询')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('consultations')
export class ConsultationController {
  constructor(private readonly service: ConsultationService) {}

  @Post()
  @ApiOperation({ summary: '发起 AI 咨询（SSE 流式返回）' })
  async startConsultation(
    @Req() req: any,
    @Res() res: Response,
    @Body() dto: StartConsultationDto,
  ) {
    return this.service.startSSE(req.user.id, dto, res, req);
  }

  @Post('redline-check')
  @HttpCode(200)
  @ApiOperation({ summary: '纯就医红线检测（无 AI 对话）' })
  async redlineCheck(
    @Req() req: any,
    @Body() dto: RedlineCheckDto,
  ) {
    return this.service.checkRedLine(req.user.id, dto.query, dto.memberId);
  }

  @Get('history')
  @ApiOperation({ summary: '对话历史（分页）' })
  @ApiQuery({ name: 'memberId', required: true })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async getHistory(
    @Req() req: any,
    @Query('memberId') memberId: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    if (!memberId) {
      throw new BadRequestException('memberId 参数为必填');
    }
    return this.service.getHistory(
      req.user.id,
      memberId,
      page ? +page : 1,
      pageSize ? +pageSize : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '获取对话详情' })
  async getDetail(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.service.getDetail(req.user.id, id);
  }

  @Post(':id/feedback')
  @ApiOperation({ summary: '提交满意度评价' })
  async submitFeedback(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: FeedbackDto,
  ) {
    return this.service.submitFeedback(
      req.user.id,
      id,
      dto.satisfaction,
      dto.feedbackText,
    );
  }
}
