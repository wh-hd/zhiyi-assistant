import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始填充开发种子数据...');

  // ---- 清理旧数据 ----
  await prisma.medicationAdherence.deleteMany();
  await prisma.medicationPlan.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.healthMetric.deleteMany();
  await prisma.healthRecord.deleteMany();
  await prisma.knowledge.deleteMany();
  await prisma.familyMember.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.family.deleteMany();
  await prisma.user.deleteMany();

  // ---- 用户 ----
  const userXiaolin = await prisma.user.create({
    data: {
      id: 'u-001',
      wxOpenid: 'dev_openid_xiaolin',
      nickname: '晓琳',
      gender: 2,
      ageGroup: '25-34',
    },
  });

  // ---- 家庭 ----
  const family = await prisma.family.create({
    data: {
      id: 'f-001',
      name: '我的家',
      createdBy: userXiaolin.id,
      memberCount: 4,
    },
  });

  // ---- 家庭成员 ----
  const memberDad = await prisma.familyMember.create({
    data: {
      id: 'm-001',
      familyId: family.id,
      nickname: '爸爸',
      relation: 'parent',
      role: 'member',
      age: 48,
      gender: 1,
      isPrimary: true,
      sortOrder: 1,
    },
  });

  const memberMom = await prisma.familyMember.create({
    data: {
      id: 'm-002',
      familyId: family.id,
      nickname: '妈妈',
      relation: 'parent',
      role: 'member',
      age: 45,
      gender: 2,
      sortOrder: 2,
    },
  });

  const memberBaby = await prisma.familyMember.create({
    data: {
      id: 'm-003',
      familyId: family.id,
      nickname: '宝宝',
      relation: 'child',
      role: 'member',
      age: 1,
      gender: 0,
      sortOrder: 3,
    },
  });

  // 晓琳自己
  await prisma.familyMember.create({
    data: {
      id: 'm-000',
      familyId: family.id,
      userId: userXiaolin.id,
      nickname: '晓琳',
      relation: 'self',
      role: 'admin',
      age: 32,
      gender: 2,
      sortOrder: 0,
    },
  });

  // ---- 健康档案 ----
  await prisma.healthRecord.createMany({
    data: [
      {
        memberId: memberDad.id,
        bloodType: 'A',
        heightCm: 172,
        weightKg: 75,
        chronicDiseases: JSON.stringify([
          { disease: '高血压', diagnosedYear: 2020, severity: 'mild', underControl: true, notes: '服药控制中' },
        ]),
        allergies: '[]',
        surgeries: '[]',
        familyHistory: JSON.stringify([{ condition: '高血压', relation: '父亲' }]),
        lastAssessmentScore: 75,
      },
      {
        memberId: memberMom.id,
        bloodType: 'B',
        heightCm: 160,
        weightKg: 58,
        chronicDiseases: '[]',
        allergies: JSON.stringify([{ allergen: '青霉素', severity: 'moderate' }]),
        surgeries: '[]',
        familyHistory: '[]',
        lastAssessmentScore: 85,
      },
      {
        memberId: memberBaby.id,
        bloodType: 'O',
        heightCm: 76,
        weightKg: 10.5,
        chronicDiseases: '[]',
        allergies: '[]',
        surgeries: '[]',
        vaccinations: JSON.stringify([
          { name: '乙肝疫苗(第3针)', date: '2025-12-01' },
          { name: '脊髓灰质炎疫苗', date: '2026-01-15' },
        ]),
      },
    ],
  });

  // ---- 用药计划 ----
  const planValsartan = await prisma.medicationPlan.create({
    data: {
      id: 'med-001',
      memberId: memberDad.id,
      familyId: family.id,
      medicineName: '缬沙坦',
      medicineCode: 'C09CA03',
      dosage: '80mg',
      dosageUnit: '片',
      frequency: 'daily',
      customSchedule: JSON.stringify([{ time: '08:00', dosage: '1片', note: '饭后' }]),
      startDate: new Date('2026-01-01'),
      createdBy: userXiaolin.id,
      isActive: true,
      notes: '降压药，每天早餐后服用',
    },
  });

  const planMetformin = await prisma.medicationPlan.create({
    data: {
      id: 'med-002',
      memberId: memberDad.id,
      familyId: family.id,
      medicineName: '二甲双胍',
      dosage: '500mg',
      dosageUnit: '片',
      frequency: 'daily',
      customSchedule: JSON.stringify([{ time: '12:30', dosage: '1片', note: '随午餐服用' }]),
      startDate: new Date('2026-01-01'),
      createdBy: userXiaolin.id,
      isActive: true,
    },
  });

  // ---- 用药依从性 ----
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.medicationAdherence.createMany({
    data: [
      { planId: planValsartan.id, scheduledAt: new Date(today.getTime() + 8 * 3600000), status: 'taken', takenAt: new Date(today.getTime() + 8.5 * 3600000) },
      { planId: planMetformin.id, scheduledAt: new Date(today.getTime() + 12.5 * 3600000), status: 'taken', takenAt: new Date(today.getTime() + 12.75 * 3600000) },
      // 昨天（漏服模拟）
      { planId: planValsartan.id, scheduledAt: new Date(today.getTime() - 86400000 + 8 * 3600000), status: 'missed', missedNotified: true },
    ],
  });

  // ---- 健康指标 ----
  const daysAgo = (d: number) => new Date(today.getTime() - d * 86400000);
  for (let i = 6; i >= 0; i--) {
    await prisma.healthMetric.createMany({
      data: [
        { memberId: memberDad.id, metricType: 'blood_pressure_systolic', value: 125 + Math.floor(Math.random() * 15), unit: 'mmHg', recordedAt: daysAgo(i), groupId: `bp-${i}` },
        { memberId: memberDad.id, metricType: 'blood_pressure_diastolic', value: 82 + Math.floor(Math.random() * 10), unit: 'mmHg', recordedAt: daysAgo(i), groupId: `bp-${i}` },
      ],
    });
  }

  // ---- 指标阈值 ----
  await prisma.metricThreshold.createMany({
    data: [
      { metricType: 'blood_pressure_systolic', minNormal: 90, maxNormal: 140 },
      { metricType: 'blood_pressure_diastolic', minNormal: 60, maxNormal: 90 },
      { metricType: 'blood_glucose_fasting', minNormal: 3.9, maxNormal: 6.1 },
      { metricType: 'blood_glucose_postprandial', minNormal: 3.9, maxNormal: 7.8 },
      { metricType: 'heart_rate', minNormal: 60, maxNormal: 100 },
      { metricType: 'body_fat', minNormal: 10, maxNormal: 30 },
      { metricType: 'temperature', minNormal: 36.0, maxNormal: 37.3 },
      { metricType: 'spo2', minNormal: 95, maxNormal: 100 },
      { metricType: 'bmi', minNormal: 18.5, maxNormal: 24 },
      { metricType: 'steps', minNormal: 6000, maxNormal: 20000 },
      { metricType: 'sleep', minNormal: 6, maxNormal: 10 },
      { metricType: 'stress', minNormal: 0, maxNormal: 70 },
    ],
  });

  // ---- 健康知识库 ----
  await prisma.knowledge.createMany({
    data: [
      {
        category: 'chronic_disease', title: '高血压患者的日常管理要点',
        summary: '规律服药、限盐饮食、定期监测血压是控制高血压的三大基石。',
        content: '1. 遵医嘱按时服用降压药，切勿自行停药。\n2. 每日食盐摄入控制在5克以内。\n3. 建议每日固定时间测量血压并记录。\n4. 每周中等强度运动150分钟。\n5. 戒烟限酒，保持健康体重。',
        tags: JSON.stringify(['高血压', '日常管理', '用药']), sortOrder: 1, readCount: 12,
      },
      {
        category: 'medication_safety', title: '家庭用药安全常识',
        summary: '药品分类存放、看清有效期、注意相互作用，避免用药错误。',
        content: '1. 药品应存放在阴凉干燥处，避光。\n2. 定期清理过期药品。\n3. 多种药物同服前请咨询医生或药师。\n4. 儿童药品应放在儿童不易触及处。\n5. 保留药品说明书。',
        tags: JSON.stringify(['用药安全', '家庭药箱']), sortOrder: 2, readCount: 8,
      },
      {
        category: 'nutrition', title: '均衡膳食的"膳食宝塔"',
        summary: '谷薯类为主，蔬果丰富，适量鱼禽蛋肉，少油少盐。',
        content: '1. 主食粗细搭配。\n2. 每天蔬菜300-500克，水果200-350克。\n3. 优质蛋白优先鱼禽蛋瘦肉。\n4. 奶类及豆制品每天摄入。\n5. 烹调少油少盐少糖。',
        tags: JSON.stringify(['营养', '膳食', '健康饮食']), sortOrder: 3, readCount: 20,
      },
      {
        category: 'child_care', title: '婴幼儿疫苗接种时间表',
        summary: '按时完成免疫规划疫苗接种，是保护儿童健康的重要措施。',
        content: '1. 出生时：卡介苗、乙肝疫苗第1针。\n2. 1月龄：乙肝疫苗第2针。\n3. 2月龄：脊灰疫苗第1剂。\n4. 3月龄：脊灰第2剂、百白破第1剂。\n5. 6月龄：乙肝疫苗第3针、A群流脑第1剂。\n具体以当地接种门诊安排为准。',
        tags: JSON.stringify(['儿童', '疫苗', '接种']), sortOrder: 4, readCount: 15,
      },
      {
        category: 'elderly_care', title: '老年人防跌倒居家改造',
        summary: '居家防跌倒能显著降低老年人意外伤害风险。',
        content: '1. 浴室铺设防滑垫，安装扶手。\n2. 保证夜间照明，床边放置小夜灯。\n3. 清除地面杂物与门槛高差。\n4. 常用物品放在易取处，避免攀爬。\n5. 穿防滑鞋。',
        tags: JSON.stringify(['适老化', '防跌倒', '居家安全']), sortOrder: 5, readCount: 9,
      },
      {
        category: 'first_aid', title: '突发胸痛如何紧急应对',
        summary: '胸痛可能是心梗信号，务必立即就医，把握黄金抢救时间。',
        content: '1. 立即停止活动，原地休息。\n2. 拨打120急救电话。\n3. 如医生建议可舌下含服硝酸甘油（如有）。\n4. 保持镇静，解开过紧衣物。\n5. 出现意识丧失立即心肺复苏并呼叫急救。',
        tags: JSON.stringify(['急救', '胸痛', '心梗']), sortOrder: 6, readCount: 30,
      },
    ],
  });

  console.log('✅ 种子数据填充完成！');
  console.log(`   - 用户: 1 (晓琳)`);
  console.log(`   - 家庭: 1 (我的家)`);
  console.log(`   - 成员: 4 (晓琳/爸爸/妈妈/宝宝)`);
  console.log(`   - 用药计划: 2 (缬沙坦/二甲双胍)`);
  console.log(`   - 健康指标: 14条 (7天血压)`);
}

main()
  .catch((e) => {
    console.error('❌ 种子数据填充失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
