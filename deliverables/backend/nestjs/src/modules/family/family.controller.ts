import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FamilyService } from './family.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('家庭与成员')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('families')
export class FamilyController {
  constructor(private readonly service: FamilyService) {}

  @Post()
  @ApiOperation({ summary: '创建家庭' })
  async create(@Req() req: any, @Body() dto: CreateFamilyDto) {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: '获取我的家庭列表' })
  async listMyFamilies(@Req() req: any) {
    return this.service.findByUser(req.user.id);
  }

  @Get(':familyId')
  @ApiOperation({ summary: '获取家庭详情' })
  async getFamily(@Param('familyId') familyId: string, @Req() req: any) {
    return this.service.findById(familyId, req.user.id);
  }

  @Patch(':familyId')
  @ApiOperation({ summary: '更新家庭信息' })
  async updateFamily(
    @Param('familyId') familyId: string,
    @Req() req: any,
    @Body() dto: UpdateFamilyDto,
  ) {
    return this.service.update(familyId, req.user.id, dto);
  }

  // ========== 成员管理 ==========

  @Get(':familyId/members')
  @ApiOperation({ summary: '获取家庭成员列表' })
  async getMembers(@Param('familyId') familyId: string, @Req() req: any) {
    return this.service.getMembers(familyId, req.user.id);
  }

  @Post(':familyId/members')
  @ApiOperation({ summary: '添加家庭成员' })
  async addMember(
    @Param('familyId') familyId: string,
    @Req() req: any,
    @Body() dto: AddMemberDto,
  ) {
    return this.service.addMember(familyId, req.user.id, dto);
  }

  @Get(':familyId/members/:memberId')
  @ApiOperation({ summary: '获取成员详情' })
  async getMemberDetail(
    @Param('familyId') familyId: string,
    @Param('memberId') memberId: string,
    @Req() req: any,
  ) {
    return this.service.getMemberDetail(familyId, memberId, req.user.id);
  }

  @Patch(':familyId/members/:memberId')
  @ApiOperation({ summary: '更新成员信息' })
  async updateMember(
    @Param('familyId') familyId: string,
    @Param('memberId') memberId: string,
    @Req() req: any,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.service.updateMember(familyId, memberId, req.user.id, dto);
  }

  @Delete(':familyId/members/:memberId')
  @ApiOperation({ summary: '移除家庭成员' })
  async removeMember(
    @Param('familyId') familyId: string,
    @Param('memberId') memberId: string,
    @Req() req: any,
  ) {
    return this.service.removeMember(familyId, memberId, req.user.id);
  }
}
