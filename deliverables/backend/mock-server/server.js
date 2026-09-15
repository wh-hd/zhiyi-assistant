/**
 * 智医助手 Mock API Server
 * 为前端原型提供独立 Mock REST API 对接（自带内置 MOCK 数据，与已下线的 test_data.js 无关）
 *
 * 启动: node server.js
 * 默认端口: 4000
 */

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.MOCK_PORT || 4000;

// ---- 中间件 ----
app.use(cors());
app.use(express.json());
app.use((req, _res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  req.startTime = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | rid: ${req.requestId}`);
  next();
});

// ---- 统一响应 ----
function success(data, meta = {}) {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

function error(code, message, status = 400) {
  return {
    success: false,
    error: { code, message },
    meta: { timestamp: new Date().toISOString() },
    _status: status,
  };
}

// ---- 中间件: 统一响应包装 ----
app.use((req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = function (body) {
    if (body && body._status) {
      res.status(body._status);
      delete body._status;
      return origJson(body);
    }
    // SSE/Stream 不包装
    if (res.getHeader('Content-Type')?.includes('text/event-stream')) {
      return origJson(body);
    }
    return origJson(body);
  };
  next();
});

// ---- Mock 数据（独立内置，与已下线的 test_data.js 无关）----
const MOCK = {
  user: {
    name: '晓琳',
    avatarText: '晓',
    greeting: '早上好，晓琳',
    greetingSub: '今天家人都还好吗？',
    profileTag: '家庭健康管理师',
    stats: [
      { value: '3', label: '家庭成员' },
      { value: '28', label: '健康记录' },
      { value: '12', label: '咨询次数' },
    ],
  },

  home: {
    healthScore: { label: '家庭健康评分', value: 82, badge: '良好' },
    statsRow: [
      { value: '4人', label: '在管成员', variant: 'default' },
      { value: '3/4', label: '今日用药', variant: 'secondary' },
      { value: '2件', label: '待办事项', variant: 'tertiary' },
    ],
    shortcuts: [
      { label: '用药提醒', icon: 'pill', screen: 'meds' },
      { label: '健康自评', icon: 'clipboard', screen: 'assess' },
      { label: '记录指标', icon: 'chart', screen: 'metrics' },
      { label: 'AI咨询', icon: 'message', screen: 'consult' },
    ],
    familyMembers: [
      { avatarText: '爸', name: '爸爸', status: '血压偏高', statusType: 'warn', avatarColor: '#3D8A5A' },
      { avatarText: '妈', name: '妈妈', status: '健康良好', statusType: 'ok', avatarColor: '#D4A64A' },
      { avatarText: '宝', name: '宝宝', status: '1岁·健康', statusType: 'ok', avatarColor: '#D89575' },
    ],
    tasks: [
      { id: 't1', title: '提醒爸爸测量血压', detail: '08:00 · 已设置闹钟', iconBg: 'rgba(208,128,104,.1)', iconStroke: '#D08068', done: false },
      { id: 't2', title: '妈妈服用维生素D', detail: '09:00 · 随早餐服用', iconBg: 'rgba(216,149,117,.1)', iconStroke: '#D89575', done: false },
    ],
  },

  archive: {
    members: [
      { id: 'm1', avatarText: '张', avatarColor: '#3D8A5A', name: '张明 · 爸爸', detail: '48岁 · 高血压 · 定期复查中', dotColor: '#3D8A5A', memberIdx: 0 },
      { id: 'm2', avatarText: '李', avatarColor: '#D4A64A', name: '李芳 · 妈妈', detail: '45岁 · 健康状态良好', dotColor: '#3D8A5A', memberIdx: 1 },
      { id: 'm3', avatarText: '明', avatarColor: '#D89575', name: '张小明 · 儿子', detail: '12岁 · 生长发育期 · 关注营养', dotColor: '#D4A64A', memberIdx: 2 },
    ],
    events: [
      { text: '张明完成血压测量 128/85', time: '2小时前' },
      { text: '张小明体重记录 42kg', time: '昨天' },
    ],
  },

  memberDetail: [
    {
      id: 'm1',
      name: '张明',
      avatarText: '张', avatarColor: '#3D8A5A',
      info: '48岁 · 男 · 爸爸',
      statusLabel: '需关注', statusType: 'warn',
      metrics: [
        { label: '血压', value: '128/85', unit: 'mmHg · 正常偏高', unitType: 'warn' },
        { label: '体重', value: '72.5', unit: 'kg · BMI 23.8', unitType: 'default' },
        { label: '空腹血糖', value: '5.8', unit: 'mmol/L · 正常', unitType: 'ok' },
        { label: '静息心率', value: '76', unit: 'bpm · 正常', unitType: 'ok' },
      ],
      medications: [
        { name: '缬沙坦 80mg', detail: '降压药 · 每日一次 · 08:00' },
        { name: '二甲双胍 500mg', detail: '降糖药 · 每日两次 · 12:30 / 19:00' },
      ],
      timeline: [
        { time: '2026-07-08 09:00', title: '血压记录', desc: '收缩压 128 / 舒张压 85 mmHg — 正常偏高，建议持续监测', type: 'warn' },
        { time: '2026-07-07 14:00', title: '血糖记录', desc: '空腹血糖 5.8 mmol/L — 正常范围', type: 'default' },
      ],
    },
    {
      id: 'm2',
      name: '李芳',
      avatarText: '李', avatarColor: '#D4A64A',
      info: '45岁 · 女 · 妈妈',
      statusLabel: '健康', statusType: 'ok',
      metrics: [
        { label: '血压', value: '118/75', unit: 'mmHg · 正常', unitType: 'ok' },
        { label: '体重', value: '58', unit: 'kg · BMI 22.7', unitType: 'default' },
        { label: '空腹血糖', value: '5.1', unit: 'mmol/L · 正常', unitType: 'ok' },
        { label: '静息心率', value: '68', unit: 'bpm · 正常', unitType: 'ok' },
      ],
      medications: [{ name: '维生素 D 软胶囊', detail: '补充剂 · 每日一次 · 09:00' }],
      timeline: [
        { time: '2026-07-08 09:00', title: '服药记录', desc: '维生素D软胶囊已服用', type: 'default' },
      ],
    },
    {
      id: 'm3',
      name: '张小明',
      avatarText: '明', avatarColor: '#D89575',
      info: '12岁 · 男 · 儿子',
      statusLabel: '正常', statusType: 'ok',
      metrics: [
        { label: '体重', value: '42', unit: 'kg · 生长发育期', unitType: 'default' },
        { label: '身高', value: '155', unit: 'cm · 发育正常', unitType: 'ok' },
      ],
      medications: [],
      timeline: [
        { time: '2026-07-07 08:30', title: '体重记录', desc: '体重 42kg，生长发育正常', type: 'default' },
      ],
    },
  ],

  meds: {
    medications: [
      { id: 'med1', time: '08:00', timeColor: '#3D8A5A', name: '缬沙坦 80mg', detail: '张明 · 降压药 · 每日一次', taken: true },
      { id: 'med2', time: '12:30', timeColor: '#3D8A5A', name: '二甲双胍 500mg', detail: '张明 · 降糖药 · 饭后服用', taken: true },
      { id: 'med3', time: '20:00', timeColor: '#D4A64A', name: '阿托伐他汀 20mg', detail: '张明 · 降脂药 · 晚餐后服用', taken: false },
      { id: 'med4', time: '09:00', timeColor: '#3D8A5A', name: '维生素 D 软胶囊', detail: '李芳 · 补充剂 · 随早餐服用', taken: true },
    ],
    adherence: {
      label: '本周服药依从性',
      percent: '85%',
      desc: '本周共28次，已服用24次，漏服4次',
    },
  },

  metrics: {
    metrics: [
      { label: '血压（收缩压/舒张压）', value: '128 / 85', unit: 'mmHg · 正常偏高', unitType: 'warn' },
      { label: '体重', value: '65.2', unit: 'kg · BMI 23.1', unitType: 'default' },
      { label: '空腹血糖', value: '5.6', unit: 'mmol/L · 正常范围', unitType: 'ok' },
      { label: '静息心率', value: '72', unit: 'bpm · 正常', unitType: 'ok' },
    ],
    trend: {
      label: '血压趋势（近7天）',
      systolic: { color: '#3D8A5A', label: '收缩压', points: '0,65 47,58 94,62 141,52 188,56 235,48 282,53 330,50' },
      diastolic: { color: '#D89575', label: '舒张压', points: '0,82 47,76 94,79 141,72 188,75 235,68 282,73 330,70' },
    },
    records: [
      { text: '血压 128/85 mmHg · 张明', time: '今天 09:00' },
      { text: '体重 65.2 kg · 张明', time: '昨天 08:30' },
    ],
  },

  consult: {
    messages: [
      { type: 'ai', avatarColor: '#3D8A5A', text: '您好！我是智医助手AI。请描述您或家人的健康问题，我会为您提供健康咨询建议。' },
      { type: 'user', avatarColor: '#D89575', avatarText: '我', text: '我爸爸今早上血压150/95，头有点晕，需要马上去医院吗？' },
      {
        type: 'ai', avatarColor: '#3D8A5A',
        text: '根据您描述的症状，血压150/95属于轻度偏高，头晕可能是血压波动引起的。建议：先在家休息观察30分钟，保持安静环境。若头晕持续或血压超过160/100，请及时就医。',
        statusTag: '暂无风险',
      },
    ],
    disclaimer: '本AI助手提供健康建议仅供参考，不构成医疗诊断。如有紧急情况请立即就医。',
  },

  assessment: {
    pageTitle: '家庭健康自评',
    estimatedTime: '约需 30 秒',
    questions: [
      { q: '你最担心家人的哪些健康问题？', sub: '可多选', options: ['儿童成长发育', '老人日常照护', '心理健康情绪', '慢性病管理'] },
      { q: '家人目前有哪些慢性病管理需求？', sub: '可多选', options: ['高血压管理', '糖尿病管理', '高血脂管理', '暂无慢性病'] },
      { q: '你最希望获得哪些健康服务？', sub: '可多选', options: ['定期健康提醒', '家庭健康报告', '在线健康咨询', '就医绿色通道'] },
      { q: '你认为家庭健康管理最大的困难是什么？', sub: '可多选', options: ['信息不统一', '坚持困难', '缺乏专业指导', '时间精力不足'] },
    ],
  },

  assessReport: {
    id: 'ar-001',
    totalScore: 72,
    title: '您的家庭健康自评结果',
    summary: '总体健康风险中等，心血管方面需重点关注',
    concerns: [
      { rank: 1, title: '心血管风险偏高', why: '直系亲属有高血压史，自述饮食偏咸', actionSteps: ['减少食盐摄入', '每周运动3次', '建议测量血压'], featureLink: '/metrics/blood-pressure' },
      { rank: 2, title: '用药依从性待提升', why: '有漏服记录，建议设置用药提醒', actionSteps: ['开启用药提醒功能', '每周检查药品余量'], featureLink: '/meds' },
      { rank: 3, title: '缺乏定期体检', why: '上次体检超过1年', actionSteps: ['安排近期体检', '关注血压血糖指标'], featureLink: null },
    ],
    categoryScores: { chronicRisk: 65, lifestyle: 45, mentalHealth: 80, familySupport: 75 },
  },
};

// 可变状态（Mock 支持简单写入）
const state = {
  medications: JSON.parse(JSON.stringify(MOCK.meds.medications)),
  tasks: JSON.parse(JSON.stringify(MOCK.home.tasks)),
};

// ===============================================================
// 路由
// ===============================================================

// ---- 健康检查 ----
app.get('/health', (_req, res) => {
  res.json(success({ status: 'ok', service: '智医助手 Mock Server' }));
});

// ---- [API] 用户 ----
app.get('/v1/users/me', (_req, res) => {
  res.json(success(MOCK.user));
});

// ---- [API] 首页 ----
app.get('/v1/home', (_req, res) => {
  res.json(success({
    ...MOCK.home,
    tasks: state.tasks,
  }));
});

// ---- [API] 首页待办更新 ----
app.patch('/v1/home/tasks/:taskId', (req, res) => {
  const task = state.tasks.find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json(error('NOT_FOUND', '任务不存在', 404));
  task.done = req.body.done ?? !task.done;
  res.json(success(task));
});

// ---- [API] AI 咨询 ----
app.get('/v1/consultations', (_req, res) => {
  res.json(success(MOCK.consult));
});

app.post('/v1/consultations', (req, res) => {
  const { query } = req.body || {};
  if (!query) return res.status(400).json(error('INVALID_PARAM', '缺少 query 参数', 400));

  const aiResponses = {
    default: '好的，我了解了。请问您能提供更多细节吗？比如症状持续时间、是否有其他不适等。',
    头晕: '头晕可能与多种因素有关，包括血压波动、疲劳、血糖异常等。建议先测量血压，注意休息。如果头晕持续或加重，请及时就医。',
    血压: '血压管理需要长期坚持。建议每天固定时间测量血压（建议早晚各一次），保持低盐饮食，避免情绪激动。',
  };

  let responseText = aiResponses.default;
  for (const [k, v] of Object.entries(aiResponses)) {
    if (query.includes(k)) { responseText = v; break; }
  }

  const newMsg = {
    id: uuidv4(),
    type: 'ai',
    avatarColor: '#3D8A5A',
    text: responseText,
    statusTag: query.includes('急') || query.includes('痛') ? '建议就医' : '暂无风险',
    createdAt: new Date().toISOString(),
  };

  res.json(success({ message: newMsg, isRedLine: false }));
});

// ---- [API] 家庭档案 ----
app.get('/v1/archive', (_req, res) => {
  res.json(success(MOCK.archive));
});

// ---- [API] 成员详情 ----
app.get('/v1/archive/members/:memberId', (req, res) => {
  const member = MOCK.memberDetail.find(m => m.id === req.params.memberId);
  if (!member) return res.status(404).json(error('NOT_FOUND', '成员不存在', 404));
  res.json(success(member));
});

// ---- [API] 用药管理 ----
app.get('/v1/medications', (_req, res) => {
  res.json(success({
    medications: state.medications,
    adherence: MOCK.meds.adherence,
  }));
});

app.patch('/v1/medications/:medId', (req, res) => {
  const med = state.medications.find(m => m.id === req.params.medId);
  if (!med) return res.status(404).json(error('NOT_FOUND', '用药记录不存在', 404));
  med.taken = req.body.taken ?? !med.taken;

  // 更新依从性统计
  const takenCount = state.medications.filter(m => m.taken).length;
  const total = state.medications.length;
  const pct = Math.round((takenCount / total) * 100);

  res.json(success({
    medication: med,
    adherence: {
      label: '本周服药依从性',
      percent: `${pct}%`,
      desc: `本周共${total * 7}次，已服用${takenCount * 7}次`,
    },
  }));
});

// ---- [API] 健康指标 ----
app.get('/v1/metrics', (_req, res) => {
  res.json(success(MOCK.metrics));
});

app.get('/v1/metrics/trend', (_req, res) => {
  res.json(success(MOCK.metrics.trend));
});

app.post('/v1/metrics', (req, res) => {
  const record = {
    text: `指标记录 #${MOCK.metrics.records.length + 1}`,
    time: '刚刚',
    ...req.body,
  };
  MOCK.metrics.records.unshift(record);
  res.json(success(record));
});

// ---- [API] 健康自评 ----
app.get('/v1/assessments/questions', (_req, res) => {
  res.json(success(MOCK.assessment));
});

app.post('/v1/assessments/start', (_req, res) => {
  res.json(success({ assessmentId: uuidv4(), questions: MOCK.assessment.questions }));
});

app.get('/v1/assessments/:id/result', (_req, res) => {
  res.json(success(MOCK.assessReport));
});

// ---- [API] 系统统计 ----
app.get('/v1/stats', (_req, res) => {
  res.json(success({
    memberCount: MOCK.archive.members.length,
    medicationAdherence: MOCK.meds.adherence.percent,
    healthScore: MOCK.home.healthScore,
  }));
});

// ---- [API] SSE 流式模拟（AI 咨询） ----
app.post('/v1/consultations/stream', (req, res) => {
  const { query } = req.body || {};
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const aiText = '根据您的描述，我建议：\n\n1. 保持规律作息，确保充足睡眠\n2. 均衡饮食，减少高盐高脂食物摄入\n3. 适度运动，每周至少150分钟中等强度运动\n4. 定期监测血压、血糖等关键指标\n\n如有任何不适，请及时就医。';

  let idx = 0;
  const interval = setInterval(() => {
    if (idx >= aiText.length) {
      clearInterval(interval);
      res.write(`event: done\ndata: ${JSON.stringify({ finished: true })}\n\n`);
      res.end();
      return;
    }
    const chunk = aiText.slice(idx, idx + 3);
    idx += 3;
    res.write(`event: message\ndata: ${JSON.stringify({ chunk, index: idx, total: aiText.length })}\n\n`);
  }, 50);
});

// ---- 404 ----
app.use((_req, res) => {
  res.status(404).json(error('NOT_FOUND', '接口不存在', 404));
});

// ---- 启动 ----
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       智医助手 Mock API Server              ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  地址: http://localhost:${PORT}                  ║`);
  console.log(`║  健康检查: http://localhost:${PORT}/health        ║`);
  console.log('║  API 前缀: /v1                              ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  API 清单:                                   ║');
  console.log('║  GET  /v1/users/me           用户信息         ║');
  console.log('║  GET  /v1/home               首页数据         ║');
  console.log('║  GET  /v1/consultations      AI咨询           ║');
  console.log('║  POST /v1/consultations      发起咨询         ║');
  console.log('║  POST /v1/consultations/stream SSE流式        ║');
  console.log('║  GET  /v1/archive            家庭档案         ║');
  console.log('║  GET  /v1/archive/members/:id 成员详情        ║');
  console.log('║  GET  /v1/medications        用药管理         ║');
  console.log('║  PATCH /v1/medications/:id   确认服药         ║');
  console.log('║  GET  /v1/metrics            健康指标         ║');
  console.log('║  GET  /v1/metrics/trend      指标趋势         ║');
  console.log('║  GET  /v1/assessments/questions 自评题目      ║');
  console.log('║  GET  /v1/assessments/:id/result 自评结果     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
