/**
 * ============================================================
 * 就医红线规则引擎 — 安全关键组件
 * ============================================================
 *
 * 设计原则：
 * 1. 同步执行，不可异步（安全关键路径，不允许 I/O 阻塞）
 * 2. 目标延迟 <5ms
 * 3. 保守策略：宁可多触发（假阳性），不可漏判（假阴性）
 * 4. 「红线触发 ≠ AI 不回复」— 触发后仍提供健康建议但不替代就医
 * 5. 「自伤检测 → 危机干预」— 检测到立即转心理热线
 *
 * ADR-004: 就医红线本地规则引擎（非 LLM 判定）
 * ============================================================
 */

export interface UserHealthProfile {
  age?: number;
  gender?: number; // 0:未知 1:男 2:女
  chronicDiseases?: Array<{ name: string; severity?: string }>;
  allergies?: Array<{ name: string }>;
  bloodType?: string;
}

export interface RedLineResult {
  /** 是否触发红线 */
  triggered: boolean;
  /** 红线类别 */
  category?: string;
  /** 严重等级 */
  severity: 'immediate' | 'urgent' | 'advisory' | 'none';
  /** 就医建议 */
  recommendation: string;
  /** 是否需要紧急就医（120） */
  requiresEmergency?: boolean;
  /** 匹配的关键词（调试用） */
  matchedKeywords?: string[];
}

interface RedLineRule {
  category: string;
  severity: 'immediate' | 'urgent' | 'advisory';
  /** 单关键词匹配 */
  keywords?: string[];
  /** 组合关键词：需要同时命中 keywords + comboKeywords 才触发 */
  comboKeywords?: string[];
  /** 年龄检查 */
  ageMin?: number;
  ageMax?: number;
  /** 慢性病条件：需要用户有某个慢性病史才触发 */
  requireChronic?: string[];
  /** 就医建议模板 */
  recommendation: string;
  /** 是否需要紧急就医（120） */
  requiresEmergency?: boolean;
  /** 心理危机干预标记 */
  isCrisis?: boolean;
}

export class RedLineEngine {
  private rules: RedLineRule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * 同步执行红线检测
   * @param query 用户输入的咨询文本
   * @param profile 用户健康档案摘要
   * @returns 红线检测结果
   */
  check(query: string, profile?: UserHealthProfile): RedLineResult {
    const normalized = this.normalize(query);

    // 1. 优先检测心理危机（自伤/自杀）
    const crisisResult = this.checkCrisis(normalized);
    if (crisisResult) return crisisResult;

    // 2. 遍历红线规则
    for (const rule of this.rules) {
      const result = this.evaluateRule(normalized, rule, profile);
      if (result) return result;
    }

    // 3. 未触发任何红线
    return {
      triggered: false,
      severity: 'none',
      recommendation: '',
    };
  }

  /**
   * 批量检测（用于对话历史回溯分析）
   */
  checkBatch(
    queries: string[],
    profile?: UserHealthProfile,
  ): RedLineResult[] {
    return queries.map((q) => this.check(q, profile));
  }

  // ============================================================
  // 规则初始化
  // ============================================================

  private initializeRules(): void {
    this.rules = [
      // ==================== IMMEDIATE（立即就医/120） ====================

      // 心血管急症
      {
        category: 'chest_pain_cardiac',
        severity: 'immediate',
        keywords: ['胸痛', '胸闷', '心口痛', '心绞痛', '心脏疼'],
        comboKeywords: [
          '冷汗', '呼吸困难', '喘不上气', '左胳膊', '左臂', '左肩',
          '恶心', '呕吐', '头晕', '晕厥',
        ],
        recommendation:
          '⚠️ 可能为心血管急症（急性心梗等），请立即拨打120或前往最近医院急诊科。\n' +
          '🚨 保持静止，不要自行驾车。如有阿司匹林可嚼服一片（无过敏史前提下）。',
        requiresEmergency: true,
      },

      // 脑卒中（FAST 原则）
      {
        category: 'stroke_symptom',
        severity: 'immediate',
        keywords: [
          '嘴歪', '口角歪斜', '说话不清楚', '口齿不清', '半身麻木',
          '半身无力', '一侧无力', '突然看不清', '视物模糊',
          '走路不稳', '剧烈头痛', '突然晕倒',
        ],
        recommendation:
          '⚠️ 可能为脑卒中（中风）征兆。\n' +
          '🚨 请立即拨打120！记住发病时间，不要给患者进食进水。\n' +
          '让患者平卧，头偏向一侧（防止呕吐窒息）。',
        requiresEmergency: true,
      },

      // 呼吸困难/窒息
      {
        category: 'breathing_emergency',
        severity: 'immediate',
        keywords: [
          '呼吸困难', '喘不上气', '窒息', '憋气', '呼吸急促',
          '嘴唇发紫', '口唇发绀',
        ],
        recommendation:
          '⚠️ 严重呼吸困难为医疗急症。\n' +
          '🚨 请立即就医或拨打120。保持坐姿身体前倾，如有哮喘请使用急救药物。',
        requiresEmergency: true,
      },

      // 大出血
      {
        category: 'major_bleeding',
        severity: 'immediate',
        keywords: [
          '吐血', '咯血', '便血', '大出血', '大量出血',
          '出血不止', '血便', '黑便',
        ],
        recommendation:
          '⚠️ 活动性出血需紧急就医。\n' +
          '🚨 请立即前往最近医院急诊科。用干净纱布压迫止血，不要自行服用止血药。',
        requiresEmergency: true,
      },

      // 意识障碍
      {
        category: 'consciousness_loss',
        severity: 'immediate',
        keywords: [
          '意识不清', '昏迷', '晕倒', '晕厥', '不省人事',
          '叫不醒', '抽搐', '痉挛', '癫痫',
        ],
        recommendation:
          '⚠️ 意识障碍为紧急情况。\n' +
          '🚨 请立即拨打120。将患者侧卧，保持呼吸道通畅，不要强行约束抽搐。',
        requiresEmergency: true,
      },

      // 严重过敏
      {
        category: 'severe_allergy',
        severity: 'immediate',
        keywords: [
          '过敏性休克', '全身皮疹', '喉咙肿胀', '喉头水肿',
          '呼吸困难', '全身红肿',
        ],
        recommendation:
          '⚠️ 可能为严重过敏反应（过敏性休克）。\n' +
          '🚨 请立即拨打120。如有肾上腺素笔请立即使用。',
        requiresEmergency: true,
      },

      // ==================== URGENT（尽快就医） ====================

      // 儿童高热
      {
        category: 'high_fever_child',
        severity: 'immediate',
        keywords: ['发烧', '高烧', '高热', '发热'],
        comboKeywords: ['孩子', '宝宝', '小孩', '儿童', '婴儿'],
        ageMax: 12,
        recommendation:
          '⚠️ 儿童（≤12岁）高热需警惕。\n' +
          '建议立即前往儿科急诊就医。物理降温（温水擦身，避免捂汗），途中注意观察精神状态。\n' +
          '如出现惊厥/抽搐，保持侧卧，不要强行按压。',
        requiresEmergency: true,
      },

      // 持续高热（成人）
      {
        category: 'persistent_high_fever',
        severity: 'urgent',
        keywords: ['发烧', '高烧', '高热', '反复发烧', '持续发烧'],
        comboKeywords: ['3天', '三天', '不退', '持续', '反复', '39度', '39℃'],
        recommendation:
          '⚠️ 持续高热不退（≥3天或≥39℃）建议尽早就医，明确感染原因。\n' +
          '多饮水，物理降温，密切关注体温变化。',
      },

      // 血压升高伴症状（需关注 / 尽快就医）
      {
        category: 'elevated_blood_pressure',
        severity: 'urgent',
        keywords: ['血压'],
        comboKeywords: [
          '头晕', '眩晕', '头痛', '恶心', '呕吐', '胸闷', '心慌', '心悸',
          '视物模糊', '耳鸣', '一侧无力', '一侧麻木', '说话不清', '嘴歪', '意识不清',
        ],
        recommendation:
          '⚠️ 血压升高并伴随不适症状需引起重视。\n' +
          '建议：① 静坐休息15-30分钟后复查血压；② 避免剧烈活动与情绪激动；\n' +
          '③ 若血压持续≥160/100mmHg，或出现一侧肢体无力、言语不清、剧烈头痛、胸闷胸痛、意识不清，请立即拨打120或前往急诊。\n' +
          '④ 如本身有高血压史，请按医嘱服药，勿自行停药。',
        requiresEmergency: false,
      },

      // 剧烈腹痛
      {
        category: 'severe_abdominal_pain',
        severity: 'urgent',
        keywords: [
          '剧烈腹痛', '腹部剧痛', '肚子剧痛', '刀割样', '绞痛',
          '右下腹痛', '转移性腹痛',
        ],
        recommendation:
          '⚠️ 剧烈腹痛可能为急腹症（阑尾炎/胰腺炎/肠梗阻等）。\n' +
          '建议立即前往医院急诊外科。就医前禁食禁水。',
      },

      // 不明原因体重下降
      {
        category: 'unexplained_weight_loss',
        severity: 'advisory',
        keywords: ['体重下降', '消瘦', '暴瘦'],
        comboKeywords: [
          '没减肥', '没有节食', '不明原因', '突然', '一个月', '两个月',
        ],
        recommendation:
          '⚠️ 短期内不明原因体重下降需排查。\n' +
          '建议前往内科/内分泌科就诊，完善血常规、肿瘤标志物、甲功等检查。',
      },

      // 持续咳嗽/咳血
      {
        category: 'persistent_cough_hemoptysis',
        severity: 'urgent',
        keywords: ['咳血', '咯血', '痰中带血', '血丝痰'],
        recommendation:
          '⚠️ 咳血需尽快就医排查。\n' +
          '建议前往呼吸内科就诊，可能需要胸部CT等检查。',
      },

      // 视力突发改变
      {
        category: 'sudden_vision_change',
        severity: 'urgent',
        keywords: [
          '突然看不见', '视力突然下降', '眼前发黑', '视野缺损',
          '眼睛看不见',
        ],
        recommendation:
          '⚠️ 突发视力改变需紧急排查。\n' +
          '可能为视网膜脱落/眼底出血/视神经病变等，建议立即前往眼科急诊。',
      },

      // 慢性病加重（有慢性病史的用户）
      {
        category: 'chronic_disease_worsening',
        severity: 'urgent',
        keywords: [
          '加重', '恶化', '越来越严重', '控制不住', '药不管用',
        ],
        requireChronic: [
          '高血压', '糖尿病', '冠心病', '心衰', '慢阻肺', 'COPD',
          '哮喘', '肝硬化', '肾病', '肾功能不全',
        ],
        recommendation:
          '⚠️ 慢性病症状加重需要医疗干预。\n' +
          '请尽快联系你的主治医生或前往相应科室就诊，不要自行调药。',
      },

      // 孕妇相关
      {
        category: 'pregnancy_concern',
        severity: 'urgent',
        keywords: ['怀孕', '孕妇', '孕期'],
        comboKeywords: [
          '腹痛', '出血', '见红', '破水', '胎动减少', '剧烈头痛',
          '视力模糊', '水肿严重',
        ],
        recommendation:
          '⚠️ 孕期出现异常症状需立即就医。\n' +
          '请立即联系产科医生或前往医院产科急诊。',
      },
    ];
  }

  // ============================================================
  // 规则评估
  // ============================================================

  private evaluateRule(
    query: string,
    rule: RedLineRule,
    profile?: UserHealthProfile,
  ): RedLineResult | null {
    // 年龄条件检查
    if (rule.ageMin !== undefined && profile?.age !== undefined) {
      if (profile.age < rule.ageMin) return null;
    }
    if (rule.ageMax !== undefined && profile?.age !== undefined) {
      if (profile.age > rule.ageMax) return null;
    }

    // 检查主关键词是否命中
    const matchedKeywords = rule.keywords
      ? rule.keywords.filter((kw) => query.includes(kw))
      : [];

    // 如果没有 comboKeywords 要求，单关键词命中即触发
    if (!rule.comboKeywords || rule.comboKeywords.length === 0) {
      if (matchedKeywords.length > 0) {
        // 检查慢性病条件
        if (rule.requireChronic && rule.requireChronic.length > 0) {
          const userDiseases = profile?.chronicDiseases?.map((d) => d.name) ?? [];
          const hasChronic = rule.requireChronic.some((c) =>
            userDiseases.some((d) => d.includes(c)),
          );
          if (!hasChronic) return null;
        }

        return {
          triggered: true,
          category: rule.category,
          severity: rule.severity,
          recommendation: rule.isCrisis
            ? rule.recommendation
            : `⚠️ 健康风险提示：${rule.recommendation}`,
          requiresEmergency: rule.severity === 'immediate',
          matchedKeywords,
        };
      }
      return null;
    }

    // 有 comboKeywords：需要主关键词 AND 组合关键词同时命中
    // 例外：若调用方已提供年龄且命中规则的年龄约束（如儿童年龄段 ageMax），
    // 则视为已具备该人群上下文，组合关键词可省略（修复 L5：儿童高热须组合词才触发）
    const ageSatisfiesCombo =
      (rule.ageMax !== undefined && profile?.age !== undefined && profile.age <= rule.ageMax) ||
      (rule.ageMin !== undefined && profile?.age !== undefined && profile.age >= rule.ageMin);
    const matchedCombos = rule.comboKeywords.filter((kw) => query.includes(kw));
    const combosSatisfied = matchedCombos.length > 0 || ageSatisfiesCombo;

    if (matchedKeywords.length > 0 && combosSatisfied) {
      // 检查慢性病条件
      if (rule.requireChronic && rule.requireChronic.length > 0) {
        const userDiseases = profile?.chronicDiseases?.map((d) => d.name) ?? [];
        const hasChronic = rule.requireChronic.some((c) =>
          userDiseases.some((d) => d.includes(c)),
        );
        if (!hasChronic) return null;
      }

      return {
        triggered: true,
        category: rule.category,
        severity: rule.severity,
        recommendation: `⚠️ 健康风险提示：${rule.recommendation}`,
        requiresEmergency: rule.severity === 'immediate',
        matchedKeywords: [...matchedKeywords, ...matchedCombos],
      };
    }

    return null;
  }

  // ============================================================
  // 心理危机检测（优先级最高）
  // ============================================================

  private checkCrisis(query: string): RedLineResult | null {
    const crisisKeywords = [
      '自杀', '不想活了', '想死', '结束生命', '活不下去',
      '没有意义', '解脱', '了结', '轻生',
      '伤害自己', '自残', '割腕', '跳楼',
    ];

    for (const kw of crisisKeywords) {
      if (query.includes(kw)) {
        return {
          triggered: true,
          category: 'self_harm_crisis',
          severity: 'immediate',
          recommendation:
            '🫂 我们非常关心你。如果你正在经历困难时刻，请记住你并不孤单。\n\n' +
            '📞 请立即联系心理危机干预热线：\n' +
            '• 全国心理援助热线：400-161-9995\n' +
            '• 北京心理危机研究与干预中心：010-82951332\n' +
            '• 生命热线：400-821-1215\n\n' +
            '你也可以直接前往最近医院急诊科寻求帮助。你很重要，有人在乎你。',
          requiresEmergency: true,
          matchedKeywords: [kw],
        };
      }
    }
    return null;
  }

  // ============================================================
  // 文本预处理
  // ============================================================

  /**
   * 归一化：转小写 + 去除多余空格 + 统一标点
   */
  private normalize(text: string): string {
    return (
      text
        .toLowerCase()
        // 统一标点
        .replace(/[,，]/g, '，')
        .replace(/[.。]/g, '。')
        // 去除多余空白
        .replace(/\s+/g, '')
    );
  }
}
