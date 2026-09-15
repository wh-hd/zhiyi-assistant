import {
  Controller, Get, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('健康知识库')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  @Get()
  @ApiOperation({ summary: '获取健康知识列表 (支持分类/关键词筛选)' })
  async list(
    @Req() req: any,
    @Query('category') category?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      category,
      keyword,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('categories')
  @ApiOperation({ summary: '获取知识分类及数量' })
  async categories(@Req() req: any) {
    return this.service.categories();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取知识文章详情 (自增阅读量)' })
  async getById(@Param('id') id: string, @Req() req: any) {
    return this.service.getById(id);
  }
}
