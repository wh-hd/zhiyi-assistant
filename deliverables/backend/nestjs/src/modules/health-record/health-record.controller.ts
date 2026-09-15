import {
  Controller, Get, Patch, Param, Body, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HealthRecordService } from './health-record.service';
import { UpdateHealthRecordDto } from './dto/update-record.dto';
import { UpdateChronicDiseasesDto } from './dto/update-chronic.dto';
import { UpdateAllergiesDto } from './dto/update-allergy.dto';
import { UpdateSurgeriesDto } from './dto/update-surgery.dto';
import { UpdateFamilyHistoryDto } from './dto/update-family-history.dto';
import { UpdateVaccinationsDto } from './dto/update-vaccination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('健康档案')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('health-records')
export class HealthRecordController {
  constructor(private readonly service: HealthRecordService) {}

  @Get(':memberId')
  @ApiOperation({ summary: '获取成员健康档案' })
  async getRecord(
    @Param('memberId') memberId: string,
    @Req() req: any,
  ) {
    return this.service.getByMemberId(memberId, req.user.id);
  }

  @Patch(':memberId')
  @ApiOperation({ summary: '更新健康档案基本信息' })
  async updateRecord(
    @Param('memberId') memberId: string,
    @Req() req: any,
    @Body() dto: UpdateHealthRecordDto,
  ) {
    return this.service.update(memberId, req.user.id, dto);
  }

  @Patch(':memberId/chronic-diseases')
  @ApiOperation({ summary: '管理慢病史（全量替换）' })
  async updateChronicDiseases(
    @Param('memberId') memberId: string,
    @Req() req: any,
    @Body() dto: UpdateChronicDiseasesDto,
  ) {
    return this.service.updateChronicDiseases(memberId, req.user.id, dto);
  }

  @Patch(':memberId/allergies')
  @ApiOperation({ summary: '管理过敏史（全量替换）' })
  async updateAllergies(
    @Param('memberId') memberId: string,
    @Req() req: any,
    @Body() dto: UpdateAllergiesDto,
  ) {
    return this.service.updateAllergies(memberId, req.user.id, dto);
  }

  @Patch(':memberId/surgeries')
  @ApiOperation({ summary: '管理手术史（全量替换）' })
  async updateSurgeries(
    @Param('memberId') memberId: string,
    @Req() req: any,
    @Body() dto: UpdateSurgeriesDto,
  ) {
    return this.service.updateSurgeries(memberId, req.user.id, dto);
  }

  @Patch(':memberId/family-history')
  @ApiOperation({ summary: '管理家族史（全量替换）' })
  async updateFamilyHistory(
    @Param('memberId') memberId: string,
    @Req() req: any,
    @Body() dto: UpdateFamilyHistoryDto,
  ) {
    return this.service.updateFamilyHistory(memberId, req.user.id, dto);
  }

  @Patch(':memberId/vaccinations')
  @ApiOperation({ summary: '管理疫苗接种史（全量替换）' })
  async updateVaccinations(
    @Param('memberId') memberId: string,
    @Req() req: any,
    @Body() dto: UpdateVaccinationsDto,
  ) {
    return this.service.updateVaccinations(memberId, req.user.id, dto);
  }

  @Get(':memberId/export')
  @ApiOperation({ summary: '导出健康档案（PDF 数据）' })
  async exportRecord(
    @Param('memberId') memberId: string,
    @Req() req: any,
  ) {
    return this.service.exportRecord(memberId, req.user.id);
  }
}
