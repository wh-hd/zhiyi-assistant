/**
 * 红线引擎测试用例
 * 运行: npx ts-node src/shared/red-line-engine/red-line-engine.test.ts
 */

import { RedLineEngine, UserHealthProfile } from './red-line-engine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

const engine = new RedLineEngine();

// ============================================================
// Test 1: 心血管急症检测
// ============================================================
const result1 = engine.check('胸痛，还出冷汗');
assert(result1.triggered, '胸痛+冷汗应触发红线');
assert(result1.severity === 'immediate', '胸痛应为 immediate 等级');
assert(result1.category === 'chest_pain_cardiac', '类别应为 chest_pain_cardiac');

// ============================================================
// Test 2: 脑卒中 FAST 检测
// ============================================================
const result2 = engine.check('我感觉半身麻木，说话也说不清楚');
assert(result2.triggered, '半身麻木+说话不清应触发中风红线');

// ============================================================
// Test 3: 心理危机检测（最高优先级）
// ============================================================
const result3 = engine.check('我有时候真的觉得不想活了');
assert(result3.triggered, '不想活了应触发危机干预');
assert(result3.category === 'self_harm_crisis', '类别应为 self_harm_crisis');

// ============================================================
// Test 4: 正常咨询（不应触发）
// ============================================================
const result4 = engine.check('最近睡眠不太好，有什么建议吗');
assert(!result4.triggered, '正常咨询不应触发红线');

// ============================================================
// Test 5: 儿童高热 + 年龄条件
// ============================================================
const childProfile: UserHealthProfile = { age: 5 };
const result5 = engine.check('孩子发高烧了', childProfile);
assert(result5.triggered, '5岁儿童高烧应触发红线');
assert(result5.category === 'high_fever_child', '类别应为 high_fever_child');

// 成人高热（不触发儿童专属规则）
const adultProfile: UserHealthProfile = { age: 30 };
const result5b = engine.check('发烧了', adultProfile);
assert(!result5b.triggered, '成人单纯说发烧不应触发儿童高热规则');

// L5 修复：已知年龄≤12 的儿童高热，即使未显式提及"孩子/宝宝"也应触发 immediate
const childNoCombo: UserHealthProfile = { age: 5 };
const result5c = engine.check('发高烧39度了', childNoCombo);
assert(result5c.triggered, '已知年龄≤12的儿童高热应触发红线（无需组合词）');
assert(result5c.category === 'high_fever_child', '类别应为 high_fever_child');
assert(result5c.severity === 'immediate', '儿童高热应为 immediate 等级');

// ============================================================
// Test 6: 呼吸困难
// ============================================================
const result6 = engine.check('喘不上气了，感觉要窒息');
assert(result6.triggered, '呼吸困难应触发红线');

// ============================================================
// Test 7: 大出血
// ============================================================
const result7 = engine.check('今天早上发现便血了');
assert(result7.triggered, '便血应触发红线');

// ============================================================
// Test 8: 意识障碍
// ============================================================
const result8 = engine.check('我爸爸突然晕倒了');
assert(result8.triggered, '晕倒应触发红线');

// ============================================================
// Test 9: 慢性病加重（需要慢性病史）
// ============================================================
const chronicProfile: UserHealthProfile = {
  chronicDiseases: [{ name: '高血压' }],
};
const result9 = engine.check('最近血压控制不住了，药不管用', chronicProfile);
assert(result9.triggered, '高血压用户说"控制不住"应触发慢性病加重红线');
assert(result9.category === 'chronic_disease_worsening', '类别应为 chronic_disease_worsening');

// 无慢性病史的用户（不应触发）
const noChronicProfile: UserHealthProfile = {};
const result9b = engine.check('最近血压控制不住了，药不管用', noChronicProfile);
assert(!result9b.triggered, '无慢性病史用户不应触发慢性病加重红线');

// ============================================================
// Test 10: 性能基准（<5ms）
// ============================================================
const perfQueries = [
  '最近有点胸痛',
  '孩子发高烧39度了该怎么办',
  '感觉半身无力，嘴有点歪',
  '喘不上气感觉要窒息了',
  '今天早上咳血了',
];

const start = performance.now();
for (const q of perfQueries) {
  engine.check(q);
}
const elapsed = (performance.now() - start).toFixed(2);
assert(
  parseFloat(elapsed) < 25, // 5 条查询 <25ms = 平均 <5ms
  `性能基准: 5条查询 ${elapsed}ms (目标: <25ms, 平均: ${(parseFloat(elapsed) / 5).toFixed(2)}ms)`,
);

// ============================================================
// Test 11: batchCheck
// ============================================================
const batchResults = engine.checkBatch([
  '胸痛，出冷汗',
  '今天天气不错',
  '不想活了',
]);
assert(batchResults.length === 3, '批量检测应返回3个结果');
assert(batchResults[0].triggered, '第1条应触发');
assert(!batchResults[1].triggered, '第2条不应触发');
assert(batchResults[2].triggered, '第3条应触发（危机干预）');

console.log('\n🎯 红线引擎测试全部完成！');
