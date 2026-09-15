import {
  Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssessmentService } from './assessment.service';
import {
  AssessmentHistoryQueryDto, StartAssessmentDto, SubmitAnswerDto,
} from './dto/assessment.dto';
import { ManualReviewDto } from './dto/manual-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('健康自评')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assessments')
export class AssessmentController {
  constructor(private readonly service: AssessmentService) {}

  @Post('start')
  @ApiOperation({ summary: '开始自评（返回第一步题目）' })
  async start(
    @Req() req: any,
    @Body() dto: StartAssessmentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.service.start(req.user.id, dto, idempotencyKey);
  }

  @Post('answer')
  @ApiOperation({ summary: '提交当前步骤答案' })
  async answer(@Req() req: any, @Body() dto: SubmitAnswerDto) {
    return this.service.submitAnswer(req.user.id, dto);
  }

  @Get(':id/result')
  @ApiOperation({ summary: '获取自评结果' })
  async getResult(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.service.getResult(id, req.user.id);
  }

  @Get('history')
  @ApiOperation({ summary: '自评历史（分页）' })
  async getHistory(@Req() req: any, @Query() query: AssessmentHistoryQueryDto) {
    return this.service.getHistory(
      req.user.id,
      query.memberId,
      query.page,
      query.pageSize,
    );
  }

  @Post('manual-review')
  @ApiOperation({ summary: '手动触发复评' })
  async manualReview(
    @Req() req: any,
    @Body() dto: ManualReviewDto,
  ) {
    return this.service.manualReview(req.user.id, dto.memberId);
  }
}
