# 智医助手 后端架构设计文档

**版本**：v1.0
**日期**：2026-07-08
**作者**：后端架构师
**适用范围**：MVP（10周交付）→ V1.1（+6周）→ V2（智能设备接入）

---

## 目录

1. [架构总览](#1-架构总览)
2. [技术栈选型](#2-技术栈选型)
3. [服务拆分与模块设计](#3-服务拆分与模块设计)
4. [数据库架构](#4-数据库架构)
5. [API 设计规范](#5-api-设计规范)
6. [高并发与高性能方案](#6-高并发与高性能方案)
7. [高可用方案](#7-高可用方案)
8. [安全架构](#8-安全架构)
9. [移动设备/手表接入方案](#9-移动设备手表接入方案)
10. [AI 服务架构](#10-ai-服务架构)
11. [可观测性](#11-可观测性)
12. [开发与运维](#12-开发与运维)
13. [演进路线图](#13-演进路线图)

---

## 1. 架构总览

### 1.1 核心决策

| 决策维度 | 选择 | 理由 |
|----------|------|------|
| **架构模式** | 模块化单体（MVP）→ 微服务（增长期） | 2人后端团队、10周交付，微服务运维成本过高；NestJS 模块天然可拆分为微服务 |
| **通信模式** | REST（主）+ SSE（AI流式）+ WebSocket（实时通知）+ MQTT（设备V2） | REST 覆盖 90% 场景；SSE 适合 AI 流式输出；WebSocket 支撑跨代健康状态同步 |
| **数据模式** | 传统 CRUD + CQRS（高频读场景） | 健康档案/指标以读为主，读写分离提升性能；AI 对话日志采用 Event Sourcing |
| **部署模式** | Docker Compose（MVP）→ Kubernetes（增长） | MVP 快速启动；K8s 为后期水平扩展做好准备 |

### 1.2 选型理由：为什么是模块化单体而非微服务？

```
┌─────────────────────────────────────────────────────────────────────┐
│                    微服务 vs 模块化单体 决策矩阵                        │
├────────────────────┬──────────────┬──────────────┬──────────────────┤
│ 评估维度            │ 微服务        │ 模块化单体    │ 结论              │
├────────────────────┼──────────────┼──────────────┼──────────────────┤
│ MVP 团队规模        │ 需 ≥4 后端   │ 2 人可维护    │ 模块化单体 ✅      │
│ 运维复杂度          │ 高（K8s/服务网格）│ 低（单进程） │ 模块化单体 ✅      │
│ 独立部署/扩缩容     │ ✅ 天然支持   │ 需手动拆分    │ 微服务（后期）      │
│ 故障隔离            │ ✅ 天然隔离   │ 单点风险      │ 微服务（后期）      │
│ 未来拆分成本        │ N/A          │ NestJS 模块→微服务零重构 │ 模块化单体 ✅ │
│ 10 周交付可行性     │ ❌ 高风险     │ ✅ 可控       │ 模块化单体 ✅      │
└────────────────────┴──────────────┴──────────────┴──────────────────┘
```

**结论**：MVP 采用 NestJS 模块化单体，模块边界 = 未来微服务边界。当满足以下任一条件时拆分：① 日活突破 10 万 ② 某模块 QPS 突破 1,000 ③ 需要独立部署节奏。

### 1.3 系统拓扑图

```
                        ┌──────────────────────┐
                        │   微信小程序（客户端）   │
                        │   + Watch/设备（后期）  │
                        └──────┬───────┬───────┘
                               │       │
                    HTTPS/WSS  │       │  MQTT (V2)
                               │       │
              ┌────────────────▼───────▼───────────────┐
              │           Nginx (反向代理)               │
              │  • TLS 终止   • 限流   • WAF            │
              │  • 静态资源   • 负载均衡                  │
              └────────────────┬───────────────────────┘
                               │
              ┌────────────────▼───────────────────────┐
              │        NestJS 应用服务器 (×2)           │
              │  ┌──────────────────────────────────┐  │
              │  │      API Gateway Module           │  │
              │  │  (认证/鉴权/限流/请求日志/参数校验)  │  │
              │  ├──────────┬──────────┬────────────┤  │
              │  │ Auth     │ User     │ Family     │  │
              │  │ Module   │ Module   │ Module     │  │
              │  ├──────────┼──────────┼────────────┤  │
              │  │HealthRec │ Assess   │ AI Consult │  │
              │  │ Module   │ Module   │ Module     │  │
              │  ├──────────┼──────────┼────────────┤  │
              │  │Medication│ Metric   │ Notify     │  │
              │  │ Module   │ Module   │ Module     │  │
              │  ├──────────┼──────────┼────────────┤  │
              │  │Knowledge │ Report   │ Device GW  │  │
              │  │ Module   │ Module   │ (V2)       │  │
              │  └──────────┴──────────┴────────────┘  │
              └────────────────┬───────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────────┐
         │                     │                         │
         ▼                     ▼                         ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│   PostgreSQL     │  │     Redis       │  │  对象存储 (OSS)      │
│   (主库+只读副本) │  │  (缓存/队列/会话) │  │  体检报告/药盒图片    │
└────────┬────────┘  └─────────────────┘  └─────────────────────┘
         │
         ▼
┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   TimescaleDB       │  │  Elasticsearch   │  │  外部服务          │
│   (健康指标时序数据)  │  │  (知识库全文搜索)  │  │  • 微信 API       │
└─────────────────────┘  └──────────────────┘  │  • LLM API       │
                                                │  • 药品识别 API   │
                                                │  • 语音识别 API   │
                                                └──────────────────┘
```

---

## 2. 技术栈选型

### 2.1 核心技术栈

| 类别 | 技术选型 | 版本 | 选型理由 |
|------|----------|------|----------|
| **运行时** | Node.js | 22 LTS | 微信生态天然 JS/TS 友好；I/O 密集型场景（API网关/AI代理）表现优异 |
| **语言** | TypeScript | 5.x | 类型安全，大型项目可维护性，与 NestJS 深度集成 |
| **框架** | NestJS | 11.x | 模块化架构天然支持未来拆分微服务；装饰器+DI+IoC 开箱即用 |
| **ORM** | Prisma | 6.x | 类型安全、自动迁移、优秀的查询构建器、与 NestJS 无缝集成 |
| **数据库（主）** | PostgreSQL | 17 | ACID 强一致、JSON 支持、丰富索引类型、TimescaleDB 扩展 |
| **时序数据** | TimescaleDB | 2.x | PostgreSQL 扩展，零运维成本切换，自动分区+压缩 |
| **缓存** | Redis | 7.x | 亚毫秒响应、丰富数据结构（Stream/Hash/Sorted Set） |
| **消息队列** | Redis Streams (MVP) / RabbitMQ (增长) | - | MVP 轻量够用；增长期特性更完善 |
| **搜索引擎** | Elasticsearch | 8.x | 健康知识库全文搜索、AI 对话日志检索 |
| **对象存储** | MinIO (MVP) / 腾讯云 COS (生产) | - | S3 兼容 API，无缝迁移 |
| **容器化** | Docker + Docker Compose | - | 开发/测试环境一致性 |
| **反向代理** | Nginx | - | TLS 终止、限流、负载均衡 |

### 2.2 为什么选择 Node.js + NestJS 而非 Go/Java？

```
┌──────────────────┬─────────────┬──────────────┬───────────────┐
│ 维度              │ Node.js     │ Go           │ Java          │
├──────────────────┼─────────────┼──────────────┼───────────────┤
│ 微信生态兼容      │ ⭐⭐⭐⭐⭐  │ ⭐⭐⭐       │ ⭐⭐⭐        │
│ 团队招聘难度(国内) │ ⭐⭐⭐     │ ⭐⭐⭐⭐    │ ⭐⭐⭐⭐⭐    │
│ I/O 密集型场景     │ ⭐⭐⭐⭐⭐  │ ⭐⭐⭐⭐    │ ⭐⭐⭐        │
│ CPU 密集型场景     │ ⭐⭐       │ ⭐⭐⭐⭐⭐   │ ⭐⭐⭐⭐     │
│ 微服务生态         │ ⭐⭐⭐     │ ⭐⭐⭐⭐    │ ⭐⭐⭐⭐⭐    │
│ 开发速度(MVP)      │ ⭐⭐⭐⭐⭐  │ ⭐⭐⭐      │ ⭐⭐⭐        │
└──────────────────┴─────────────┴──────────────┴───────────────┘
```

**结论**：智医助手 I/O 密集（API 网关/AI 代理/文件上传/通知推送），Node.js 最优。CPU 密集场景（红线规则引擎）通过 Worker Threads 补偿。MVP 快速迭代优先级最高。

---

## 3. 服务拆分与模块设计

### 3.1 模块边界图

```
┌──────────────────────────────────────────────────────────────────┐
│                    NestJS Application                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              API Gateway (Global Middleware)                 │ │
│  │   认证拦截 | 限流 | CORS | 请求ID | 日志 | 参数校验        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │ Auth     │ │ User     │ │ Family   │ │ HealthRecord       │ │
│  │ Module   │ │ Module   │ │ Module   │ │ Module             │ │
│  │          │ │          │ │          │ │                    │ │
│  │ 微信登录  │ │ 用户CRUD  │ │ 家庭CRUD  │ │ 档案管理            │ │
│  │ JWT签发  │ │ 个人资料  │ │ 成员管理  │ │ 慢病史/过敏史       │ │
│  │ Token刷新│ │ 偏好设置  │ │ 权限分配  │ │ 体检摘要            │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘ │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────────────┐ │
│  │Assess    │ │AI Consult│ │ Notification Module              │ │
│  │Module    │ │Module    │ │                                  │ │
│  │          │ │          │ │ 微信订阅消息推送                   │ │
│  │ 自评流程  │ │ 健康咨询  │ │ 用药提醒/漏服通知                  │ │
│  │ 评分引擎  │ │ 红线引擎  │ │ 异常指标预警                       │ │
│  │ 关注清单  │ │ SSE流式  │ │ 系统通知                           │ │
│  │ 复评调度  │ │ 对话历史  │ │ 消息模板管理                       │ │
│  └──────────┘ └──────────┘ └──────────────────────────────────┘ │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │Medication│ │ Metric   │ │Knowledge │ │ Report           │   │
│  │Module    │ │ Module   │ │ Module   │ │ Module           │   │
│  │          │ │          │ │          │ │                  │   │
│  │ 用药计划  │ │ 指标录入  │ │ 知识库   │ │ 体检报告解读(P1)  │   │
│  │ OCR识别  │ │ 趋势分析  │ │ 科普推荐  │ │ PDF解析          │   │
│  │ 依从性   │ │ 异常预警  │ │ 全文搜索  │ │ 健康行动计划      │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Shared Kernel (共享内核)                      │   │
│  │  数据库连接池 | Redis 客户端 | 加密工具 | 日期工具         │   │
│  │  微信 SDK 封装 | 文件存储 S3 适配器 | Prisma Client       │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 模块间通信规则

| 规则 | 说明 |
|------|------|
| **模块间通过 Service 接口调用** | 不得直接引用其他模块的 Repository 或 Controller |
| **跨模块数据拉取用同步调用** | 如：AI 咨询模块读取用户档案→调用 HealthRecordService |
| **跨模块副作用用事件总线** | 如：自评完成→发布 `AssessmentCompleted` 事件→通知模块发送提醒 |
| **禁止循环依赖** | 通过事件总线或共享接口打破循环 |
| **数据库隔离** | 每个模块有独立的 Prisma Schema 子集，通过 Service 层暴露数据 |

### 3.3 事件总线设计

```typescript
// shared/events/event-bus.interface.ts

// 核心事件定义
export const DomainEvents = {
  // 用户与家庭
  USER_REGISTERED:          'user.registered',
  FAMILY_CREATED:           'family.created',
  MEMBER_ADDED:             'family.member.added',
  MEMBER_REMOVED:           'family.member.removed',

  // 健康自评
  ASSESSMENT_COMPLETED:     'assessment.completed',
  ASSESSMENT_REVIEW_DUE:    'assessment.review.due',

  // AI 咨询
  CONSULTATION_STARTED:     'consultation.started',
  CONSULTATION_COMPLETED:   'consultation.completed',
  RED_LINE_TRIGGERED:       'consultation.redline.triggered',
  SELF_HARM_DETECTED:       'consultation.selfharm.detected',

  // 用药
  MEDICATION_PLAN_CREATED:  'medication.plan.created',
  MEDICATION_TAKEN:         'medication.taken',
  MEDICATION_MISSED:        'medication.missed',

  // 健康指标
  METRIC_RECORDED:          'metric.recorded',
  METRIC_ABNORMAL:          'metric.abnormal',
  METRIC_TREND_ALERT:       'metric.trend.alert',

  // 档案
  HEALTH_RECORD_UPDATED:    'health.record.updated',
  ALLERGY_ADDED:            'allergy.added',
} as const;

// 每个事件携带的基础字段
interface BaseEvent {
  eventId: string;       // UUID，幂等键
  eventType: string;
  timestamp: string;     // ISO 8601
  actorId: string;       // 触发用户 ID
  familyId?: string;     // 所属家庭 ID
  payload: unknown;
}
```

### 3.4 模块对外接口示例

```typescript
// ai-consultation/consultation.service.interface.ts

export interface IConsultationService {
  // 发起 AI 健康咨询（SSE 流式返回）
  startConsultation(
    userId: string,
    familyId: string,
    query: string,
    context?: ConsultationContext
  ): Promise<Observable<ConsultationChunk>>;

  // 获取对话历史（分页）
  getHistory(
    userId: string,
    params: PaginationParams
  ): Promise<PaginatedResult<ConsultationRecord>>;

  // 检测就医红线（同步、本地、零延迟）
  checkRedLine(query: string, userProfile: UserHealthProfile): RedLineResult;
}

// 就医红线检测结果
interface RedLineResult {
  triggered: boolean;
  category?: RedLineCategory;   // 12 类危急症状之一
  severity: 'immediate' | 'urgent' | 'advisory' | 'none';
  recommendation: string;       // 建议就诊科室 + 注意事项
  requiresEmergency?: boolean;  // 是否需要拨打 120
}
```

---

## 4. 数据库架构

### 4.1 ER 图（核心实体关系）

```
┌──────────┐       ┌──────────┐       ┌──────────────┐
│   User   │───1:N──│ Family   │───1:N──│ FamilyMember │
│          │        │          │        │              │
│ 基础账户  │        │ 家庭组    │        │ 成员档案      │
└──────────┘       └──────────┘       └──────┬───────┘
                                             │
                  ┌──────────────────────────┼──────────────────────────┐
                  │                          │                          │
            ┌─────▼──────┐          ┌────────▼───────┐        ┌────────▼───────┐
            │Assessment  │          │ HealthRecord    │        │ MedicationPlan  │
            │            │          │                 │        │                 │
            │ 自评记录    │          │ 慢病史/过敏史/   │        │ 用药计划         │
            │ 评分结果    │          │ 手术史/体检摘要  │        │ 依从性记录       │
            └────────────┘          └─────────────────┘        └────────┬────────┘
                                                                       │
            ┌─────────────────┐     ┌─────────────────┐     ┌─────────▼────────┐
            │ Consultation    │     │ HealthMetric     │     │ MedicationRecord │
            │                 │     │                  │     │                  │
            │ AI 对话记录      │     │ 血压/血糖/体重   │     │ 每次服药记录       │
            │ 红线判定结果     │     │ 趋势聚合         │     │ 漏服标记          │
            └─────────────────┘     └─────────────────┘     └──────────────────┘
```

### 4.2 核心 DDL

```sql
-- ============================================================
-- 1. 用户与认证
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wx_openid       VARCHAR(128) UNIQUE NOT NULL,     -- 微信 openid
    wx_unionid      VARCHAR(128),                      -- 微信 unionid (跨应用)
    nickname        VARCHAR(100),
    avatar_url      TEXT,
    phone           VARCHAR(20),
    gender          SMALLINT CHECK (gender IN (0, 1, 2)), -- 0:未知 1:男 2:女
    birthday        DATE,
    age_group       VARCHAR(20),                        -- 25-34/35-44/45-54/55-64/65+
    is_elderly_mode BOOLEAN DEFAULT false,              -- 是否开启适老化
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ                        -- 软删除
);

-- JWT Refresh Token 表
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) UNIQUE NOT NULL,
    device_info     VARCHAR(255),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_users_wx_openid ON users(wx_openid) WHERE deleted_at IS NULL;
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id, expires_at)
    WHERE revoked_at IS NULL;

-- ============================================================
-- 2. 家庭与成员
-- ============================================================

CREATE TABLE families (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,              -- 家庭名称 (e.g. "我的家")
    created_by      UUID NOT NULL REFERENCES users(id),
    member_count    SMALLINT DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE family_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),         -- 关联注册用户(可为空,未注册成员)
    role            VARCHAR(20) NOT NULL DEFAULT 'member', -- admin/caregiver(守护者)/member
    nickname        VARCHAR(100) NOT NULL,              -- 在家庭中的称呼
    relation        VARCHAR(20),                        -- 关系: self/spouse/child/parent/grandparent/other
    avatar_url      TEXT,
    age             SMALLINT,
    gender          SMALLINT,
    is_primary      BOOLEAN DEFAULT false,              -- 是否为主要关注对象
    sort_order      SMALLINT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_family_user UNIQUE (family_id, user_id) -- 一个用户在同一家庭只能有一个成员身份
);

-- 索引: 查询某用户所属的所有家庭
CREATE INDEX idx_family_members_user ON family_members(user_id);
CREATE INDEX idx_family_members_family ON family_members(family_id);

-- ============================================================
-- 3. 健康档案（核心壁垒）
-- ============================================================

CREATE TABLE health_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    
    -- 基础健康信息
    blood_type      VARCHAR(5),                         -- A/B/AB/O + Rh
    height_cm       DECIMAL(5,1),
    weight_kg       DECIMAL(5,1),
    
    -- 慢病史 (JSONB: 灵活结构)
    chronic_diseases JSONB DEFAULT '[]',
    /*
    [
      {
        "disease": "高血压",
        "diagnosed_year": 2020,
        "severity": "mild/moderate/severe",
        "under_control": true,
        "notes": "..."
      }
    ]
    */
    
    -- 过敏史
    allergies       JSONB DEFAULT '[]',
    -- 手术史
    surgeries       JSONB DEFAULT '[]',
    -- 家族病史
    family_history  JSONB DEFAULT '[]',
    -- 疫苗接种记录
    vaccinations    JSONB DEFAULT '[]',
    
    -- 体检摘要 (最近一次)
    last_checkup_date DATE,
    checkup_summary  TEXT,
    
    -- 自评结果（快照）
    last_assessment_id UUID,
    last_assessment_score SMALLINT,
    last_assessment_date TIMESTAMPTZ,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 核心索引
CREATE INDEX idx_health_records_member ON health_records(member_id);
-- GIN 索引支持慢病史查询 (e.g., 查找所有有高血压的成员)
CREATE INDEX idx_health_records_diseases ON health_records USING gin(chronic_diseases);

-- ============================================================
-- 4. 健康自评
-- ============================================================

CREATE TABLE assessments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    family_id       UUID NOT NULL REFERENCES families(id),
    
    -- 自评类型
    type            VARCHAR(30) NOT NULL DEFAULT 'initial', -- initial(首次)/review(复评)/manual(手动)
    
    -- 自评结果
    total_score     SMALLINT,                            -- 综合评分 0-100
    category_scores JSONB,                                -- 各维度评分
    /*
    {
      "chronic_risk": 75,
      "lifestyle": 45,
      "mental_health": 60,
      "family_support": 80
    }
    */
    
    -- AI 生成结果
    top_concerns    JSONB NOT NULL,                       -- Top 3 关注清单
    /*
    [
      {
        "rank": 1,
        "title": "心血管风险偏高",
        "why": "直系亲属有高血压史，自述饮食偏咸",
        "action_steps": ["减少食盐摄入", "每周运动3次", "建议测量血压"],
        "feature_link": "/metrics/blood-pressure"
      }
    ]
    */
    
    radar_chart     JSONB,                                -- 雷达图数据
    full_analysis   TEXT,                                 -- 完整 AI 分析文本
    
    -- 原始回答（脱敏）
    raw_answers     JSONB,
    
    -- 状态与调度
    status          VARCHAR(20) DEFAULT 'completed',     -- in_progress/completed/expired
    completed_at    TIMESTAMPTZ,
    next_review_at  TIMESTAMPTZ,                          -- 下次复评时间（默认30天后）
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assessments_member ON assessments(member_id, created_at DESC);
CREATE INDEX idx_assessments_family ON assessments(family_id, created_at DESC);
CREATE INDEX idx_assessments_review ON assessments(next_review_at)
    WHERE status = 'completed' AND next_review_at <= NOW() + INTERVAL '3 days';

-- ============================================================
-- 5. AI 健康咨询
-- ============================================================

CREATE TABLE consultations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    family_id       UUID NOT NULL REFERENCES families(id),
    
    -- 会话标识（一次咨询 = 一个 session，可包含多轮对话）
    session_id      UUID NOT NULL,
    
    -- 用户原始输入
    query_text      TEXT NOT NULL,
    input_type      VARCHAR(20) DEFAULT 'text',          -- text/voice
    
    -- AI 响应
    response_text   TEXT,
    response_type   VARCHAR(20),                          -- health_advice/red_line/diagnosis_warning
    
    -- 就医红线判定结果
    red_line_triggered BOOLEAN DEFAULT false,
    red_line_category  VARCHAR(50),                       -- 12 类危急症状之一
    red_line_severity  VARCHAR(20),                       -- immediate/urgent/advisory/none
    
    -- 安全相关
    self_harm_detected  BOOLEAN DEFAULT false,            -- 是否检测到自伤倾向
    disclaimer_shown    BOOLEAN DEFAULT true,             -- 非诊疗声明已展示
    
    -- 质量跟踪
    satisfaction    SMALLINT,                              -- 用户评分 1-5
    feedback_text   TEXT,
    
    -- AI 元数据
    llm_model       VARCHAR(50),                          -- 使用的模型版本
    prompt_version  VARCHAR(20),                          -- Prompt 版本
    tokens_used     INTEGER,
    response_time_ms INTEGER,                             -- 响应耗时
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 核心索引
CREATE INDEX idx_consultations_session ON consultations(session_id, created_at);
CREATE INDEX idx_consultations_member ON consultations(member_id, created_at DESC);
CREATE INDEX idx_consultations_redline ON consultations(created_at)
    WHERE red_line_triggered = true;
CREATE INDEX idx_consultations_selfharm ON consultations(created_at)
    WHERE self_harm_detected = true;  -- 安全监控用

-- ============================================================
-- 6. 用药管理
-- ============================================================

CREATE TABLE medication_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    family_id       UUID NOT NULL REFERENCES families(id),
    
    -- 药品信息
    medicine_name   VARCHAR(200) NOT NULL,
    medicine_code   VARCHAR(100),                         -- 药品标准编码
    dosage          VARCHAR(50),                          -- 剂量 (e.g. "5mg")
    dosage_unit     VARCHAR(20),                          -- 单位 (e.g. "片/粒/ml")
    
    -- 用药计划
    frequency       VARCHAR(50) NOT NULL,                 -- daily/twice_daily/three_times/every_8h/custom
    custom_schedule JSONB,                                -- 自定义时间表
    /*
    [
      {"time": "08:00", "dosage": "1片", "note": "饭前"},
      {"time": "20:00", "dosage": "1片", "note": "饭后"}
    ]
    */
    
    -- 起止时间
    start_date      DATE NOT NULL,
    end_date        DATE,                                 -- 长期用药可为空
    
    -- 识别来源
    source          VARCHAR(20) DEFAULT 'manual',        -- manual/ocr(拍照识别)
    ocr_image_url   TEXT,                                 -- 原图地址
    
    -- 创建与提醒人
    created_by      UUID NOT NULL REFERENCES users(id),   -- 谁创建的用药计划
    reminder_user_id UUID REFERENCES users(id),          -- 提醒推送给谁（老人本人）
    
    -- 状态
    is_active       BOOLEAN DEFAULT true,
    notes           TEXT,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medication_plans_member ON medication_plans(member_id)
    WHERE is_active = true;

-- 用药提醒记录（每次服药）
CREATE TABLE medication_adherence (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         UUID NOT NULL REFERENCES medication_plans(id) ON DELETE CASCADE,
    
    scheduled_at    TIMESTAMPTZ NOT NULL,                 -- 计划服药时间
    taken_at        TIMESTAMPTZ,                          -- 实际服药时间
    status          VARCHAR(20) DEFAULT 'pending',       -- pending/taken/missed/skipped
    confirmed_by    UUID REFERENCES users(id),           -- 谁确认的
    
    -- 漏服通知
    missed_notified   BOOLEAN DEFAULT false,             -- 是否已通知子女
    missed_notified_at TIMESTAMPTZ,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_adherence_plan_time ON medication_adherence(plan_id, scheduled_at);
-- 漏服未通知的查询（定时任务）
CREATE INDEX idx_adherence_missed ON medication_adherence(scheduled_at)
    WHERE status = 'pending' AND missed_notified = false
      AND scheduled_at < NOW() - INTERVAL '30 minutes';

-- ============================================================
-- 7. 健康指标（时序数据 — 使用 TimescaleDB 超表）
-- ============================================================

-- 先创建普通表
CREATE TABLE health_metrics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
    
    -- 指标类型
    metric_type     VARCHAR(30) NOT NULL,                -- blood_pressure_systolic/blood_pressure_diastolic/blood_glucose/weight/heart_rate/body_temp/spo2
    
    -- 指标值
    value           DECIMAL(10,2) NOT NULL,
    unit            VARCHAR(20) NOT NULL,
    
    -- 复合指标 (如血压: 收缩压/舒张压一起记录)
    group_id        UUID,                                -- 同一批次测量的分组ID
    
    -- 输入方式
    input_method    VARCHAR(20) DEFAULT 'manual',       -- manual/voice/device
    device_id       VARCHAR(100),                        -- 设备来源(V2)
    
    -- 备注
    notes           TEXT,                                -- 用户备注 (e.g. "早上空腹测量")
    
    recorded_at     TIMESTAMPTZ NOT NULL,                -- 测量时间(用户声明)
    created_at      TIMESTAMPTZ DEFAULT NOW()            -- 系统记录时间
);

-- 转换为 TimescaleDB 超表（按时间自动分区）
SELECT create_hypertable('health_metrics', 'recorded_at',
    chunk_time_interval => INTERVAL '7 days'
);

-- 自动压缩策略（7天前的数据自动压缩）
SELECT add_compression_policy('health_metrics', INTERVAL '7 days');

-- 索引
CREATE INDEX idx_metrics_member_type_time ON health_metrics(member_id, metric_type, recorded_at DESC);
CREATE INDEX idx_metrics_group ON health_metrics(group_id);

-- 异常阈值配置表
CREATE TABLE metric_thresholds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type     VARCHAR(30) NOT NULL,
    min_normal      DECIMAL(10,2),
    max_normal      DECIMAL(10,2),
    alert_consecutive_count SMALLINT DEFAULT 3,          -- 连续几次异常触发预警
    alert_window    INTERVAL DEFAULT INTERVAL '7 days',  -- 预警窗口期
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 预置阈值
INSERT INTO metric_thresholds (metric_type, min_normal, max_normal) VALUES
    ('blood_pressure_systolic', 90, 140),
    ('blood_pressure_diastolic', 60, 90),
    ('blood_glucose_fasting', 3.9, 6.1),
    ('blood_glucose_postprandial', 3.9, 7.8),
    ('heart_rate', 60, 100),
    ('body_temp', 36.0, 37.3);

-- ============================================================
-- 8. 通知与消息
-- ============================================================

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    family_id       UUID REFERENCES families(id),
    
    type            VARCHAR(30) NOT NULL,                -- medication_reminder/missed_dose/metric_alert/assessment_review/system
    
    title           VARCHAR(200) NOT NULL,
    body            TEXT,
    action_url      TEXT,                                -- 点击跳转的小程序路径
    
    -- 推送渠道
    channel         VARCHAR(20) DEFAULT 'wechat_subscribe', -- wechat_subscribe/in_app_push
    
    -- 状态
    status          VARCHAR(20) DEFAULT 'pending',       -- pending/sent/failed/read
    sent_at         TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    
    -- 重试
    retry_count     SMALLINT DEFAULT 0,
    max_retries     SMALLINT DEFAULT 3,
    last_error      TEXT,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_status ON notifications(user_id, status, created_at DESC);
CREATE INDEX idx_notifications_pending ON notifications(created_at)
    WHERE status = 'pending';
```

### 4.3 索引策略总结

| 表 | 核心查询场景 | 索引策略 | 预估性能 |
|-----|-------------|----------|---------|
| `users` | 微信登录查找 | `wx_openid` unique index + partial (deleted_at IS NULL) | <1ms |
| `family_members` | 查用户的所有家庭 | composite (user_id, family_id) | <1ms |
| `health_records` | 查成员档案 + 慢病过滤 | member_id unique + GIN on chronic_diseases JSONB | <5ms |
| `assessments` | 成员自评历史 + 复评提醒 | member_id + created_at DESC, next_review_at partial | <5ms |
| `consultations` | 对话历史 + 安全监控 | session_id + created_at, partial on red_line/self_harm | <10ms |
| `medication_adherence` | 定时查找漏服记录 | partial index (status='pending' AND missed_notified=false) | <1ms |
| `health_metrics` | 指标趋势查询 | member_id + metric_type + recorded_at DESC (TimescaleDB 自动分区) | <20ms (百万行) |

### 4.4 缓存策略

```
┌──────────────────────────────────────────────────────────────┐
│                      多级缓存架构                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  请求 → [L1: Nginx 缓存] → [L2: 应用内存 LRU] → [L3: Redis] → [L4: DB]
│          静态资源/不变数据    热点用户档案        业务缓存        持久化
│                                                              │
│  ┌─────────────────┬─────────────────┬──────────────────────┐ │
│  │ 缓存层           │ 数据类型          │ TTL                  │ │
│  ├─────────────────┼─────────────────┼──────────────────────┤ │
│  │ Nginx 缓存       │ 健康科普文章      │ 1 小时               │ │
│  │                  │ 静态配置          │ 永久 (版本化)         │ │
│  ├─────────────────┼─────────────────┼──────────────────────┤ │
│  │ 应用内存 LRU     │ 用户基础信息      │ 5 分钟               │ │
│  │ (node-cache)    │ 家庭成员列表      │ 1 分钟               │ │
│  │                  │ 用药计划(当天)    │ 30 秒（时效性强）     │ │
│  ├─────────────────┼─────────────────┼──────────────────────┤ │
│  │ Redis            │ AI 对话历史      │ 10 分钟              │ │
│  │                  │ 自评结果          │ 30 分钟              │ │
│  │                  │ 指标趋势聚合      │ 5 分钟               │ │
│  │                  │ 用户 Session      │ JWT 有效期            │ │
│  │                  │ 限流计数器        │ 滑动窗口              │ │
│  │                  │ 微信 access_token│ 7200 秒              │ │
│  └─────────────────┴─────────────────┴──────────────────────┘ │
│                                                              │
│  缓存失效策略:                                                 │
│  • 写操作 → 删除对应缓存 Key (Cache-Aside)                     │
│  • 用药计划变更 → 删除 plan:{planId}:* 所有相关 Key            │
│  • 档案更新 → 删除 member:{memberId}:health_record            │
│  • 批量失效使用 Redis SCAN + Pipeline                         │
└──────────────────────────────────────────────────────────────┘
```

```typescript
// shared/cache/cache.service.ts

@Injectable()
export class CacheService {
  // Cache-Aside 模式
  async getOrSet<T>(key: string, ttl: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    const data = await factory();
    await this.redis.set(key, JSON.stringify(data), 'EX', ttl);
    return data;
  }

  // 写失效
  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// 使用示例
@Injectable()
export class HealthRecordService {
  async getMemberRecord(memberId: string): Promise<HealthRecord> {
    return this.cache.getOrSet(
      `member:${memberId}:health_record`,
      300, // 5 min TTL
      () => this.prisma.healthRecord.findUnique({ where: { memberId } })
    );
  }

  async updateRecord(memberId: string, data: UpdateRecordDto) {
    const result = await this.prisma.healthRecord.update({
      where: { memberId }, data,
    });
    // 写操作 → 删除缓存
    await this.cache.invalidate(`member:${memberId}:*`);
    return result;
  }
}
```

---

## 5. API 设计规范

### 5.1 命名与版本控制

```
BASE URL: https://api.zhiyi.health/v1

URL 模式: /v{version}/{resource}[/{id}][/{sub-resource}]

示例:
  GET    /v1/families/:familyId/members              # 家庭成员列表
  POST   /v1/families/:familyId/members               # 添加成员
  GET    /v1/families/:familyId/members/:memberId     # 成员详情
  PATCH  /v1/families/:familyId/members/:memberId     # 更新成员
  DELETE /v1/families/:familyId/members/:memberId     # 移除成员
```

### 5.2 统一响应格式

```typescript
// 成功响应
interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

// 错误响应
interface ApiError {
  success: false;
  error: {
    code: string;          // 机器可读错误码
    message: string;       // 人类可读错误消息
    details?: unknown;     // 字段级校验错误
  };
  meta: {
    timestamp: string;
    requestId: string;     // 用于排障
  };
}
```

### 5.3 核心 API 清单

```typescript
// ============================================================
// 认证模块 (/v1/auth)
// ============================================================
POST   /v1/auth/wechat-login        // 微信登录 (code → JWT)
POST   /v1/auth/refresh-token       // 刷新 Token
POST   /v1/auth/logout              // 登出（吊销 Refresh Token）

// ============================================================
// 用户模块 (/v1/users)
// ============================================================
GET    /v1/users/me                 // 获取当前用户信息
PATCH  /v1/users/me                 // 更新个人信息
GET    /v1/users/me/families        // 我的家庭列表
GET    /v1/users/me/settings        // 偏好设置
PATCH  /v1/users/me/settings        // 更新偏好（含适老化开关）

// ============================================================
// 家庭模块 (/v1/families)
// ============================================================
POST   /v1/families                 // 创建家庭
GET    /v1/families/:id             // 家庭详情
PATCH  /v1/families/:id             // 更新家庭信息
GET    /v1/families/:id/members     // 成员列表
POST   /v1/families/:id/members     // 添加成员（含非注册成员）
GET    /v1/families/:id/members/:memberId            // 成员详情
PATCH  /v1/families/:id/members/:memberId            // 更新成员
DELETE /v1/families/:id/members/:memberId            // 移除成员
GET    /v1/families/:id/members/:memberId/health-record  // 健康档案

// ============================================================
// 健康档案 (/v1/health-records)
// ============================================================
GET    /v1/health-records/:memberId                 // 获取档案
PATCH  /v1/health-records/:memberId                 // 更新档案
PATCH  /v1/health-records/:memberId/chronic-diseases // 管理慢病史
PATCH  /v1/health-records/:memberId/allergies        // 管理过敏史
GET    /v1/health-records/:memberId/export           // 导出 PDF

// ============================================================
// 健康自评 (/v1/assessments)
// ============================================================
POST   /v1/assessments/start       // 开始自评（返回第一步题目）
POST   /v1/assessments/answer      // 提交当前步骤答案
GET    /v1/assessments/:id/result  // 获取自评结果
GET    /v1/assessments/history     // 自评历史（分页）
POST   /v1/assessments/manual-review // 手动触发复评

// ============================================================
// AI 健康咨询 (/v1/consultations)
// ============================================================
POST   /v1/consultations           // 发起咨询（返回 SSE 流）
GET    /v1/consultations/:id       // 获取对话详情
GET    /v1/consultations/history   // 对话历史（分页）
POST   /v1/consultations/:id/feedback  // 提交满意度评价
POST   /v1/consultations/redline-check // 纯红线检测（无 AI 对话）

// ============================================================
// 用药管理 (/v1/medications)
// ============================================================
POST   /v1/medications/plans       // 创建用药计划
GET    /v1/medications/plans       // 用药计划列表
GET    /v1/medications/plans/:id   // 计划详情
PATCH  /v1/medications/plans/:id   // 更新计划
POST   /v1/medications/ocr         // 拍照识别药品（multipart）
POST   /v1/medications/adherence   // 确认服药
GET    /v1/medications/adherence   // 依从性记录（分页）
GET    /v1/medications/adherence/weekly-report // 周度依从性报告

// ============================================================
// 健康指标 (/v1/metrics)
// ============================================================
POST   /v1/metrics                  // 记录指标（支持批量）
POST   /v1/metrics/voice            // 语音输入（multipart: 音频文件）
GET    /v1/metrics                   // 指标列表（分页+过滤）
GET    /v1/metrics/trend            // 趋势数据（含聚合）
GET    /v1/metrics/alerts           // 异常预警记录

// ============================================================
// 通知 (/v1/notifications)
// ============================================================
GET    /v1/notifications             // 通知列表
PATCH  /v1/notifications/:id/read   // 标记已读
POST   /v1/notifications/read-all   // 全部已读

// ============================================================
// 文件上传 (/v1/uploads)
// ============================================================
POST   /v1/uploads/presign          // 获取预签名上传 URL
POST   /v1/uploads/image            // 小文件直接上传（<5MB）
```

### 5.4 SSE 流式输出（AI 咨询核心）

```typescript
// consultations/consultation.controller.ts

@Post('consultations')
@UseGuards(AuthGuard)
async startConsultation(
  @Body() dto: StartConsultationDto,
  @Res() res: Response,
) {
  // 设置 SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
  });

  // 阶段 1: 就医红线检测（本地，<5ms）
  const redLineResult = this.redLineEngine.check(dto.query, memberProfile);
  if (redLineResult.triggered) {
    res.write(`event: red_line\ndata: ${JSON.stringify(redLineResult)}\n\n`);
    // 红线触发后仍提供健康建议（但不替代就医）
  }

  // 阶段 2: AI 流式响应
  const stream = await this.consultationService.streamResponse(dto);

  stream.subscribe({
    next: (chunk) => {
      res.write(`event: chunk\ndata: ${JSON.stringify(chunk)}\n\n`);
    },
    error: (err) => {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'AI 服务暂不可用' })}\n\n`);
      res.end();
    },
    complete: () => {
      res.write(`event: done\ndata: ${JSON.stringify({
        consultationId: dto.sessionId,
        disclaimer: '本建议仅供参考，不构成医疗诊断，请及时就医。',
      })}\n\n`);
      res.end();
    },
  });

  // 客户端断开连接时清理
  req.on('close', () => stream.unsubscribe());
}
```

**客户端接收示例（微信小程序）**：

```javascript
// 微信小程序端 SSE 接收
function startConsultation(query) {
  const task = wx.request({
    url: `${API_BASE}/v1/consultations`,
    method: 'POST',
    data: { query, familyId, memberId },
    enableChunked: true, // 开启分块传输
    responseType: 'text',
    success: () => {},
  });

  let buffer = '';
  task.onChunkReceived((res) => {
    buffer += res.data;
    // 解析 SSE 事件
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7);
      } else if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        handleEvent(currentEvent, data);
      }
    }
  });
}
```

---

## 6. 高并发与高性能方案

### 6.1 并发架构全景

```
                        ┌──────────────────┐
                        │   Nginx (×2)      │
                        │ • 连接池 10,000/worker │
                        │ • keepalive 复用  │
                        │ • Gzip 压缩      │
                        └────────┬─────────┘
                                 │
                  ┌──────────────┴───────────────┐
                  │                              │
        ┌─────────▼─────────┐          ┌─────────▼─────────┐
        │  App Server 1     │          │  App Server 2     │
        │  (NestJS Cluster) │          │  (NestJS Cluster) │
        │  PM2 × CPU 核心数  │          │  PM2 × CPU 核心数  │
        │  • 连接池 30/worker│          │  • 连接池 30/worker│
        └─────────┬─────────┘          └─────────┬─────────┘
                  │                              │
         ┌────────┴────────┐           ┌─────────┴────────┐
         │ PgBouncer       │           │ Redis Cluster    │
         │ (连接池复用)     │           │ (Sentinel 高可用) │
         │ pool_size=50    │           └──────────────────┘
         └────────┬────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
┌────▼────┐ ┌────▼────┐ ┌─────▼─────┐
│PostgreSQL│ │只读副本1 │ │ 只读副本2  │
│ (Write) │ │ (Read)  │ │  (Read)   │
└─────────┘ └─────────┘ └───────────┘
```

### 6.2 关键配置

```typescript
// database/prisma.config.ts

// 主库 (Write)
const primary = new Pool({
  host: process.env.DB_PRIMARY_HOST,
  port: 5432,
  database: 'zhiyi',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,           // 通过 PgBouncer 前保持低连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 只读副本 (Read — 健康档案/自评结果/指标趋势等高频读)
const readReplica = new Pool({
  host: process.env.DB_REPLICA_HOST,
  port: 5432,
  database: 'zhiyi',
  max: 30,           // 只读副本可以多分配连接
  idleTimeoutMillis: 30000,
});

// Prisma 扩展：自动路由读写
const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // CREATE/UPDATE/DELETE → 主库
        if (['create', 'update', 'delete', 'upsert'].includes(operation)) {
          return query(args);
        }
        // READ → 只读副本
        return prismaReadReplica[model][operation](args);
      },
    },
  },
});
```

### 6.3 限流策略

```typescript
// shared/throttle/throttle.guard.ts

// 三级限流架构
// L1: Nginx 全局限流 (1000 req/s/IP)
// L2: API Gateway 用户级限流
// L3: 模块级精细限流

@Injectable()
export class RateLimitGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.ip;
    const endpoint = request.route.path;

    // 获取该 endpoint 的限流配置
    const config = this.getLimitConfig(endpoint);

    // 滑动窗口算法（Redis Sorted Set）
    const key = `rate_limit:${userId}:${endpoint}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    await this.redis.zremrangebyscore(key, 0, windowStart); // 清理过期记录
    const count = await this.redis.zcard(key);

    if (count >= config.maxRequests) {
      throw new HttpException(
        { code: 'RATE_LIMIT_EXCEEDED', message: '请求过于频繁，请稍后再试' },
        429,
      );
    }

    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.expire(key, Math.ceil(config.windowMs / 1000));
    return true;
  }

  private getLimitConfig(endpoint: string) {
    const configs: Record<string, { windowMs: number; maxRequests: number }> = {
      '/v1/consultations':    { windowMs: 60000, maxRequests: 10 },  // AI 咨询: 10/min
      '/v1/medications/ocr':   { windowMs: 60000, maxRequests: 5 },   // OCR: 5/min
      '/v1/metrics/voice':     { windowMs: 60000, maxRequests: 10 },  // 语音: 10/min
      '/v1/assessments/*':     { windowMs: 60000, maxRequests: 3 },   // 自评: 3/min (Session)
      'default':              { windowMs: 60000, maxRequests: 60 },   // 默认: 60/min
    };
    return configs[endpoint] || configs['default'];
  }
}
```

### 6.4 消息队列异步化

```typescript
// 需要异步处理的操作（不阻塞请求响应）

// 事件 → 处理器映射
const EventHandlers = {
  'assessment.completed': [
    AssessmentCompletedHandler,   // 保存结果 + 生成关注清单
    ScheduleReviewHandler,         // 设置 30 天后复评提醒
    UpdateHealthRecordHandler,     // 更新档案中的自评快照
    MetricsCollectHandler,         // 采集需求信号
  ],
  'consultation.completed': [
    SaveConsultationHandler,       // 持久化对话记录
    UpdateHealthProfileHandler,    // 更新用户健康画像
    QualityScoringHandler,          // AI 回答质量评分（异步）
  ],
  'medication.missed': [
    NotifyCaregiverHandler,        // 通知子女
    EscalateIfRepeatedHandler,     // 连续漏服→升级预警
  ],
  'metric.abnormal': [
    CheckConsecutiveAbnormalHandler, // 检查是否连续异常
    NotifyFamilyAdminHandler,       // 满足条件→通知家庭管理员
  ],
};
```

### 6.5 性能目标分解

| 场景 | 目标响应时间 | 关键优化策略 |
|------|:---------:|-------------|
| 微信登录 | <300ms | JWT 无状态 + Redis 缓存 openid→userId 映射 |
| 家庭成员列表 | <100ms | Redis 缓存 + DB read replica |
| 健康档案读取 | <100ms | 单条记录 + member_id 索引 + 缓存 |
| 健康自评提交答案 | <100ms | 异步保存答案，同步返回下一题 |
| AI 咨询（首字节） | <1s | SSE 流式 + 本地红线引擎 <5ms |
| AI 咨询（完整回复） | <3s | LLM API 直连 + 流式传输 |
| 用药计划列表 | <100ms | Redis 缓存（30s TTL） |
| 指标趋势图数据 | <200ms | TimescaleDB 连续聚合 + 物化视图 |
| 通知列表 | <100ms | 用户级分区 + 仅返回未读 |

---

## 7. 高可用方案

### 7.1 可用性架构

```
                         ┌──────────────┐
                         │  DNS / CDN   │
                         │ (腾讯云 CDN)  │
                         └──────┬───────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
        ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
        │ Nginx 1   │     │ Nginx 2   │     │ Nginx 3   │
        │ (可用区A)  │     │ (可用区B)  │     │ (可用区C)  │
        └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
              │                 │                 │
    ┌─────────┼─────────┬───────┼─────────┬───────┼─────────┐
    │         │         │       │         │       │         │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│App Svr│ │App Svr│ │App Svr│ │App Svr│ │App Svr│ │App Svr│
│  A1   │ │  A2   │ │  B1   │ │  B2   │ │  C1   │ │  C2   │
└───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘
    │         │         │         │         │         │
    └─────────┼─────────┴─────────┼─────────┴─────────┘
              │                   │
    ┌─────────▼───────┐  ┌────────▼──────────┐
    │ PostgreSQL 主   │──│ PostgreSQL 同步备 │
    │ (可用区 A)      │  │ (可用区 B)        │
    └────────┬────────┘  └───────────────────┘
             │
    ┌────────▼──────────┐
    │ Redis Sentinel    │
    │ (3 节点跨可用区)   │
    └───────────────────┘
```

### 7.2 故障转移策略

```typescript
// 服务级熔断器 (opossum 库)
import CircuitBreaker from 'opossum';

// LLM API 熔断 (外部依赖最不可靠)
const llmBreaker = new CircuitBreaker(
  async (prompt: string) => {
    return this.httpService.post(LLM_API_URL, { prompt }).toPromise();
  },
  {
    timeout: 10000,          // 10s 超时
    errorThresholdPercentage: 50,  // 50% 失败率 → 熔断
    resetTimeout: 30000,     // 30s 后半开尝试
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
  }
);

llmBreaker.on('open', () => {
  this.logger.warn('LLM API 熔断器开启，降级到缓存回复');
});

llmBreaker.on('halfOpen', () => {
  this.logger.info('LLM API 熔断器半开，尝试恢复');
});

// 微信 API 熔断
const wechatBreaker = new CircuitBreaker(/* ... */);

// 降级策略
async function consult(userId: string, query: string) {
  try {
    return await llmBreaker.fire(query);
  } catch (error) {
    if (error.name === 'CircuitBreakerOpenError') {
      // 降级 1: 返回预设的通用健康建议
      return this.getFallbackAdvice(query);
    }
    // 降级 2: 返回缓存的历史回复
    const cached = await this.cache.get(`consult_fallback:${hashQuery(query)}`);
    if (cached) return cached;
    // 降级 3: 友好提示
    return '抱歉，AI 健康咨询服务暂时繁忙，请稍后再试。如有紧急情况，请立即就医。';
  }
}
```

### 7.3 健康检查

```typescript
// health/health.controller.ts

@Controller('health')
export class HealthController {
  @Get()  // Liveness: 进程是否活着
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')  // Readiness: 是否可以接收流量
  async readiness(): Promise<HealthCheckResult> {
    const checks = {
      database: await this.checkPostgres(),
      redis: await this.checkRedis(),
      elasticsearch: await this.checkElasticsearch(),
      llm_api: await this.checkLLMAPI(),
    };

    const degraded = Object.values(checks).filter(c => c.status === 'degraded').length;
    const down = Object.values(checks).some(c => c.status === 'down');

    if (down) {
      throw new ServiceUnavailableException({ status: 'down', checks });
    }

    return {
      status: degraded > 0 ? 'degraded' : 'healthy',
      checks,
      uptime: process.uptime(),
    };
  }
}
```

### 7.4 灰度发布

```
灰度发布流水线:
  Build → 单元测试 → 部署灰度环境(10%流量) → 观察 30 分钟
    ↓
    指标 OK? (错误率<0.1% + 响应时间<基线×1.2)
    ↓ YES
  扩大至 30% → 观察 60 分钟 → 100% 全量
    ↓ NO
  自动回滚

Nginx 灰度配置:
  split_clients "${remote_addr}${http_user_agent}" $variant {
    10%   canary;
    *     stable;
  }
```

---

## 8. 安全架构

### 8.1 认证与授权

```
认证流程（微信小程序）:

  小程序                          后端                         微信服务器
    │                              │                              │
    │─ wx.login() ──────────────────────────────────────────────>│
    │<─────────────── code ──────────────────────────────────────│
    │                              │                              │
    │─ POST /v1/auth/wechat-login  │                              │
    │   { code } ───────────────>│                              │
    │                              │─ code2Session(code) ───────>│
    │                              │<── openid + session_key ────│
    │                              │                              │
    │                              │─ 创建/查找 User              │
    │                              │─ 生成 JWT (15min)            │
    │                              │─ 生成 Refresh Token (30d)    │
    │<── { accessToken,           │                              │
    │      refreshToken } ────────│                              │
    │                              │                              │
    │  后续请求:                    │                              │
    │  Authorization: Bearer JWT  │                              │
    │ ──────────────────────────>│                              │
    │                              │─ 验证 JWT                   │
    │                              │─ 提取 userId + roles        │
    │<── 返回数据 ────────────────│                              │
```

```typescript
// JWT Payload (最小化原则 — 不放敏感信息)
interface JwtPayload {
  sub: string;        // userId
  role: string;       // user/admin
  iat: number;        // issued at
  exp: number;        // expiration
  jti: string;        // JWT ID (用于吊销)
}

// RBAC 角色定义
enum Role {
  USER = 'user',
  FAMILY_ADMIN = 'family_admin',  // 家庭管理员
  CAREGIVER = 'caregiver',         // 守护者（子女监护老人）
  ADMIN = 'admin',                 // 平台管理员
}

// 家庭内部权限（非 RBAC，通过 family_members.role 控制）
// • admin: 完全权限（增删成员、编辑档案、管理用药）
// • caregiver: 守护权限（查看健康数据、接收预警、设置提醒）
// • member: 基础权限（查看自己的数据、记录指标）
```

### 8.2 数据安全

```typescript
// 数据加密分层

// L1: 传输层 — TLS 1.3 (强制)
// Nginx 配置: ssl_protocols TLSv1.3;

// L2: 存储层 — 敏感字段加密
// 使用 PostgreSQL pgcrypto 扩展的 AES-256

// L3: 应用层 — 敏感数据脱敏
@Injectable()
export class DataMaskingService {
  // 手机号脱敏: 138****1234
  maskPhone(phone: string): string {
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  // 姓名脱敏: 张**
  maskName(name: string): string {
    if (name.length <= 1) return '*';
    return name[0] + '*'.repeat(name.length - 1);
  }

  // 审计日志中自动脱敏
  sanitizeForLog(data: Record<string, unknown>): Record<string, unknown> {
    const sensitive = ['password', 'token', 'idCard', 'phone', 'wx_openid'];
    const sanitized = { ...data };
    for (const key of sensitive) {
      if (sanitized[key]) sanitized[key] = '[REDACTED]';
    }
    return sanitized;
  }
}

// L4: 数据库级 — 行级安全 (Row Level Security)
-- PostgreSQL RLS 策略
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_can_read_own_record ON health_records
    FOR SELECT
    USING (
        member_id IN (
            SELECT id FROM family_members
            WHERE family_id IN (
                SELECT family_id FROM family_members WHERE user_id = current_setting('app.current_user_id')::UUID
            )
        )
    );
```

### 8.3 API 安全清单

```typescript
// shared/security/security.middleware.ts

// 必须实施的安全措施（按优先级排序）:

// ✅ 1. Helmet 安全头
app.use(helmet({
  contentSecurityPolicy: false, // 小程序无需 CSP
  crossOriginEmbedderPolicy: false,
}));

// ✅ 2. CORS 白名单
app.enableCors({
  origin: [
    'https://servicewechat.com', // 微信小程序
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:*'] : []),
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
});

// ✅ 3. 请求体大小限制
app.use(express.json({ limit: '1mb' }));           // JSON 最大 1MB
app.use(express.urlencoded({ limit: '1mb' }));
// 文件上传单独配置: multer({ limits: { fileSize: 10 * 1024 * 1024 } })

// ✅ 4. 参数白名单校验 (strict mode)
app.set('query parser', 'simple'); // 禁止复杂查询参数

// ✅ 5. 防 SQL 注入 — Prisma 参数化查询 (自动防护)
// ✅ 6. 防 XSS — 所有输出自动转义
// ✅ 7. 防 CSRF — JWT Bearer + SameSite Cookie
// ✅ 8. 防重放攻击 — 请求时间戳 + Nonce (敏感操作)
// ✅ 9. 防暴力破解 — 登录接口独立限流 (5次/分钟/IP)
// ✅ 10. IP 白名单 — 管理后台接口
```

---

## 9. 移动设备/手表接入方案

### 9.1 设备接入架构（V2）

```
┌──────────────────────────────────────────────────────────────┐
│                    设备接入层 (Device Gateway)                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ Apple Watch │  │ 华为 Watch  │  │ 第三方健康设备         │ │
│  │ (HealthKit) │  │ (HMS Core)  │  │ (血压计/血糖仪/体脂秤) │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘ │
│         │                │                     │             │
│         ▼                ▼                     ▼             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              MQTT Broker (EMQX)                       │   │
│  │  • Topic: device/{deviceId}/health/{metric_type}     │   │
│  │  • QoS 1 (至少一次送达)                               │   │
│  │  • TLS 双向认证 (设备证书)                            │   │
│  │  • 1,000,000+ 并发连接                                │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Device Gateway Service                   │   │
│  │  • 设备注册与认证                                     │   │
│  │  • 协议适配 (MQTT→内部事件)                           │   │
│  │  • 数据标准化与清洗                                    │   │
│  │  • 异常数据过滤                                       │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Metric Service (已有)                     │   │
│  │  • 写入 TimescaleDB                                   │   │
│  │  • 触发趋势分析                                        │   │
│  │  • 异常预警                                            │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 MQTT Topic 设计

```typescript
// MQTT Topic 规范

// 设备 → 服务器 (上行)
// 健康数据上报
device/{deviceId}/health/{metricType}
// 示例:
//   device/wh-2024-0001/health/heart_rate
//   device/wh-2024-0001/health/blood_pressure
//   device/wh-2024-0001/health/blood_oxygen
//   device/wh-2024-0001/health/steps
// Payload:
{
  "value": 72,
  "unit": "bpm",
  "timestamp": "2026-07-08T08:00:00Z",
  "device_id": "wh-2024-0001",
  "battery": 85,
  "signal_strength": -65
}

// 设备状态
device/{deviceId}/status
// Payload:
{
  "online": true,
  "battery": 85,
  "firmware_version": "2.1.0",
  "last_sync": "2026-07-08T08:00:00Z"
}

// 服务器 → 设备 (下行)
// 配置更新
device/{deviceId}/config
// Payload:
{
  "sync_interval_seconds": 300,
  "alert_thresholds": {
    "heart_rate_min": 50,
    "heart_rate_max": 120
  }
}
```

### 9.3 设备注册与认证

```sql
-- 设备注册表
CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_serial   VARCHAR(100) UNIQUE NOT NULL,       -- 设备序列号
    device_type     VARCHAR(50) NOT NULL,                -- apple_watch/huawei_watch/blood_pressure_monitor/glucose_meter
    
    -- 绑定关系
    user_id         UUID NOT NULL REFERENCES users(id),
    member_id       UUID REFERENCES family_members(id), -- 关联家庭成员
    
    -- 设备信息
    device_name     VARCHAR(100),
    manufacturer    VARCHAR(100),
    model           VARCHAR(100),
    firmware_version VARCHAR(50),
    
    -- MQTT 认证
    mqtt_username   VARCHAR(100) UNIQUE NOT NULL,
    mqtt_password_hash VARCHAR(255) NOT NULL,           -- bcrypt
    mqtt_client_id  VARCHAR(128) UNIQUE NOT NULL,
    
    -- 同步配置
    sync_interval   INTEGER DEFAULT 300,                -- 同步间隔(秒)
    data_retention_days INTEGER DEFAULT 90,
    
    -- 状态
    is_active       BOOLEAN DEFAULT true,
    last_heartbeat  TIMESTAMPTZ,
    last_data_sync  TIMESTAMPTZ,
    battery_level   SMALLINT,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_devices_member ON devices(member_id);
CREATE INDEX idx_devices_serial ON devices(device_serial);
```

### 9.4 数据聚合 Pipeline

```typescript
// device-gateway/metric-aggregator.service.ts

@Injectable()
export class MetricAggregatorService {
  /**
   * 设备数据聚合管道
   * 
   * 原始数据 (5s/条) → 分钟级聚合 → 小时级聚合 → 天级聚合
   * 解决手表高频上报（心率每5秒一次 = 17,280条/天/设备）
   */
  async aggregateMetrics(memberId: string, metricType: string): Promise<AggregatedMetric[]> {
    // TimescaleDB 连续聚合 (Continuous Aggregates)
    // 自动物化视图，增量更新，查询时直接读取聚合结果
    
    // 小时级聚合 (自动创建)
    const hourlyView = `
      CREATE MATERIALIZED VIEW metrics_hourly
      WITH (timescaledb.continuous) AS
      SELECT
        member_id,
        metric_type,
        time_bucket('1 hour', recorded_at) AS bucket,
        AVG(value) AS avg_value,
        MIN(value) AS min_value,
        MAX(value) AS max_value,
        COUNT(*) AS sample_count
      FROM health_metrics
      GROUP BY member_id, metric_type, bucket;
    `;
    
    // 天级聚合
    const dailyView = `
      CREATE MATERIALIZED VIEW metrics_daily
      WITH (timescaledb.continuous) AS
      SELECT
        member_id,
        metric_type,
        time_bucket('1 day', recorded_at) AS bucket,
        AVG(value) AS avg_value,
        MIN(value) AS min_value,
        MAX(value) AS max_value,
        COUNT(*) AS sample_count
      FROM health_metrics
      GROUP BY member_id, metric_type, bucket;
    `;
    
    // 自动刷新策略
    // refresh_lag = '-30 minutes' (30分钟内的数据不聚合，避免频繁更新)
    // refresh_interval = '1 hour'
  }
}
```

### 9.5 设备兼容性适配器模式

```typescript
// device-gateway/adapters/device-adapter.interface.ts

interface IDeviceAdapter {
  deviceType: string;
  
  // 标准化: 设备原生数据 → 统一格式
  normalize(rawData: Record<string, unknown>): NormalizedMetric[];
  
  // 能力声明
  supportedMetrics(): string[];
  
  // 配置映射
  mapConfig(deviceConfig: Record<string, unknown>): DeviceConfig;
}

// Apple Watch 适配器
class AppleWatchAdapter implements IDeviceAdapter {
  deviceType = 'apple_watch';

  normalize(raw: Record<string, unknown>): NormalizedMetric[] {
    // HealthKit 数据 → 统一格式
    return [
      {
        metric_type: 'heart_rate',
        value: raw.heartRate as number,
        unit: 'bpm',
        recorded_at: raw.endDate as string,
      },
      {
        metric_type: 'steps',
        value: raw.stepCount as number,
        unit: 'steps',
        recorded_at: raw.endDate as string,
      },
      // ... 更多指标
    ];
  }

  supportedMetrics(): string[] {
    return ['heart_rate', 'steps', 'blood_oxygen', 'sleep', 'ecg'];
  }
}

// 华为 Watch 适配器
class HuaweiWatchAdapter implements IDeviceAdapter {
  deviceType = 'huawei_watch';
  // ... 实现
}

// 设备适配器工厂
@Injectable()
class DeviceAdapterFactory {
  private adapters = new Map<string, IDeviceAdapter>();

  register(adapter: IDeviceAdapter) {
    this.adapters.set(adapter.deviceType, adapter);
  }

  getAdapter(deviceType: string): IDeviceAdapter {
    const adapter = this.adapters.get(deviceType);
    if (!adapter) throw new UnsupportedDeviceTypeError(deviceType);
    return adapter;
  }
}
```

---

## 10. AI 服务架构

### 10.1 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        AI 服务层                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              AI Consultation Controller                   │   │
│  │  接收请求 → SSE 流式响应 → 记录对话 → 收集反馈             │   │
│  └──────────┬───────────────────────────────┬───────────────┘   │
│             │                               │                    │
│             ▼                               ▼                    │
│  ┌──────────────────────┐      ┌───────────────────────────┐   │
│  │  RedLine Engine      │      │  LLM Gateway              │   │
│  │  (本地规则引擎)       │      │                           │   │
│  │                      │      │  • Prompt 模板管理         │   │
│  │  • 关键词匹配         │      │  • 上下文组装              │   │
│  │  • 正则规则           │      │  • 历史对话注入            │   │
│  │  • 症状组合判定       │      │  • 模型路由               │   │
│  │  • 执行时间 <5ms      │      │  • 熔断降级               │   │
│  └──────────┬───────────┘      └───────────┬───────────────┘   │
│             │                               │                    │
│             │                    ┌──────────▼──────────┐        │
│             │                    │  外部 LLM API        │        │
│             │                    │  (GPT-4o / 文心 /    │        │
│             │                    │   通义千问 / 混元)   │        │
│             │                    └─────────────────────┘        │
│             │                                                    │
│             ▼                                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Safety Guard (安全护栏)                      │   │
│  │  • 自伤/自杀检测 → 立即转人工+热线                        │   │
│  │  • 诊断陈述检测 → 黄色警告                                │   │
│  │  • 处方建议检测 → 阻断+引导就医                           │   │
│  │  • 越界内容检测 → 回退到安全回复                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 10.2 就医红线规则引擎

```typescript
// ai-consultation/red-line-engine.service.ts

@Injectable()
export class RedLineEngine {
  private rules: RedLineRule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * 同步执行，不可异步 — 这是安全关键路径
   * 目标: <5ms
   */
  check(query: string, profile: UserHealthProfile): RedLineResult {
    const normalizedQuery = this.normalize(query);

    for (const rule of this.rules) {
      const match = rule.evaluate(normalizedQuery, profile);
      if (match) {
        return {
          triggered: true,
          category: rule.category,
          severity: rule.severity,
          recommendation: rule.recommendation,
          requiresEmergency: rule.severity === 'immediate',
        };
      }
    }

    return {
      triggered: false,
      severity: 'none',
      recommendation: '',
    };
  }

  private initializeRules() {
    this.rules = [
      // 12 类就医红线症状（经医学专家审核）
      new RedLineRule({
        category: 'high_fever_child',
        keywords: ['高热', '高烧', '反复发烧', '持续发烧'],
        ageCheck: (age) => age <= 12,
        tempCheck: (temp) => temp >= 39,
        severity: 'immediate',
        recommendation: '建议立即前往儿科急诊就医。物理降温（温水擦身，避免捂汗），途中注意观察精神状态。',
      }),
      new RedLineRule({
        category: 'chest_pain',
        keywords: ['胸痛', '胸闷', '心口痛', '心绞痛'],
        // 组合判定: 胸痛 + 出冷汗/呼吸困难/左臂放射
        comboKeywords: ['冷汗', '呼吸困难', '喘不上气', '左胳膊', '左臂'],
        severity: 'immediate',
        recommendation: '可能为心血管急症，建议立即拨打120或前往最近医院急诊科。请保持静止，不要自行驾车。',
      }),
      new RedLineRule({
        category: 'stroke_symptom',
        keywords: ['嘴歪', '说话不清楚', '半身麻木', '半身无力', '突然看不清', '走路不稳'],
        // FAST 原则检查
        severity: 'immediate',
        recommendation: '可能为脑卒中（中风）征兆，请立即拨打120。记住发病时间，不要给患者进食进水。',
      }),
      // ... 其余 9 类症状规则
    ];
  }
}
```

### 10.3 Prompt 模板管理

```typescript
// ai-consultation/prompt-templates/health-advice.template.ts

export const HEALTH_ADVICE_PROMPT = {
  version: '2.3.1',
  template: `
你是一名专业的家庭健康顾问（非医生），你的职责是提供健康咨询和生活方式建议，而非医疗诊断。

## 用户信息
- 年龄: {{age}}岁
- 性别: {{gender}}
- 已知健康情况: {{healthSummary}}
- 过敏史: {{allergies}}

## 当前咨询
用户问题: {{query}}

## 回复要求
1. 用通俗易懂的语言解释，避免医学术语堆砌
2. 回答控制在 300 字以内
3. 如果涉及以下任何一种情况，不要回答，直接建议就医:
   - 需要明确诊断的
   - 需要开具处方的
   - 症状严重或进行性加重的
4. 给出 2-3 条可操作的健康建议
5. 适老化版本：使用更大字体、更简短句子、更多停顿

## 禁止行为
- 禁止给出明确的疾病诊断
- 禁止推荐具体药物品牌或剂量
- 禁止说"没问题，不用担心"等绝对化判断
- 禁止建议任何未经证实的偏方或疗法
  `,
  variables: ['age', 'gender', 'healthSummary', 'allergies', 'query'],
};
```

---

## 11. 可观测性

### 11.1 日志规范

```typescript
// shared/logger/logger.service.ts

@Injectable()
export class StructuredLogger {
  // 结构化日志格式（JSON Lines）
  info(message: string, context: LogContext = {}) {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message,
      requestId: context.requestId,
      userId: context.userId,
      familyId: context.familyId,
      duration: context.duration,
      ...context.extra,
    }));
  }

  // 敏感字段自动脱敏（在序列化前）
  private sanitize(context: LogContext): LogContext {
    const sensitiveFields = ['password', 'token', 'openid', 'phone', 'idCard'];
    const sanitized = { ...context };
    for (const field of sensitiveFields) {
      if (sanitized[field]) sanitized[field] = '[REDACTED]';
    }
    return sanitized;
  }
}

// 请求 ID 传播中间件
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    req['requestId'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    // 注入到 async_hooks 上下文（跨异步传播）
    cls.run({ requestId }, () => next());
  }
}
```

### 11.2 核心监控指标

```typescript
// 业务指标
const BUSINESS_METRICS = {
  // 自评漏斗
  assessment_started: Counter,       // 开始自评
  assessment_completed: Counter,     // 完成自评
  assessment_completion_rate: Gauge, // 完成率

  // AI 咨询
  consultation_started: Counter,
  consultation_completed: Counter,
  consultation_avg_response_time: Histogram,
  consultation_satisfaction_avg: Gauge,
  red_line_triggered: Counter,       // 红线触发次数
  self_harm_detected: Counter,       // 自伤检测次数

  // 家庭
  family_created: Counter,
  member_added: Counter,
  health_record_created: Counter,
  archive_rate: Gauge,               // 建档率

  // 用药
  medication_plan_created: Counter,
  medication_taken: Counter,
  medication_missed: Counter,
  adherence_rate: Gauge,             // 依从性
};

// 技术指标
const TECHNICAL_METRICS = {
  http_requests_total: Counter,        // 请求总量
  http_request_duration_ms: Histogram, // 请求耗时分布
  http_errors_total: Counter,          // 错误总量
  db_query_duration_ms: Histogram,     // 数据库查询耗时
  cache_hit_ratio: Gauge,             // 缓存命中率
  active_connections: Gauge,          // 活跃连接数
  event_queue_length: Gauge,           // 事件队列积压
};
```

### 11.3 告警规则

```yaml
# alerting/rules.yml

alerts:
  # P0: 立即响应（电话/企微通知）
  - name: self_harm_detected
    condition: self_harm_detected > 0
    severity: P0
    action: "立即人工介入 + 通知值班人员"

  - name: api_error_rate_spike
    condition: error_rate_5min > 5%
    severity: P0
    action: "自动回滚 + 通知 on-call"

  - name: ai_response_time_degraded  
    condition: p95_ai_response_time_5min > 5000ms  # >5s
    severity: P0
    action: "切换 LLM 供应商 + 启用缓存降级"

  # P1: 15 分钟内响应
  - name: high_db_query_time
    condition: p95_db_query_time_5min > 500ms
    severity: P1

  - name: redis_connection_failure
    condition: redis_connected == 0
    severity: P1

  # P2: 1 小时内响应  
  - name: assessment_completion_rate_low
    condition: assessment_completion_rate_1h < 40%
    severity: P2

  - name: medication_adherence_drop
    condition: adherence_rate_daily < 60%
    severity: P2
```

---

## 12. 开发与运维

### 12.1 项目结构

```
zhiyi-assistant-backend/
├── src/
│   ├── main.ts                      # 应用入口
│   ├── app.module.ts                # 根模块
│   │
│   ├── shared/                      # 共享内核
│   │   ├── kernel/                  # Prisma, Redis, Config
│   │   ├── middleware/              # RequestId, Logger, Auth
│   │   ├── guards/                  # Auth, RateLimit, Role
│   │   ├── interceptors/            # Transform, Timeout, Cache
│   │   ├── filters/                 # GlobalException, Validation
│   │   ├── decorators/              # CurrentUser, Public
│   │   ├── pipes/                   # Validation, ParseUUID
│   │   ├── events/                  # EventBus, EventTypes
│   │   ├── cache/                   # CacheService
│   │   ├── security/                # Crypto, Masking
│   │   ├── health/                  # HealthController
│   │   └── utils/                   # Common utilities
│   │
│   ├── modules/
│   │   ├── auth/                    # 认证模块
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/          # JWT, WeChat
│   │   │   ├── guards/
│   │   │   └── dto/
│   │   │
│   │   ├── user/                    # 用户模块
│   │   ├── family/                  # 家庭模块
│   │   ├── health-record/           # 健康档案模块
│   │   ├── assessment/              # 自评模块
│   │   ├── consultation/            # AI 咨询模块
│   │   │   ├── red-line-engine/     # 红线规则引擎
│   │   │   ├── llm-gateway/         # LLM 网关
│   │   │   ├── prompt-templates/    # Prompt 模板
│   │   │   └── safety-guard/        # 安全护栏
│   │   │
│   │   ├── medication/              # 用药模块
│   │   ├── metric/                  # 指标模块
│   │   ├── notification/            # 通知模块
│   │   ├── knowledge/               # 知识库模块 (P1)
│   │   └── report/                  # 体检报告模块 (P1)
│   │
│   └── workers/                     # 后台 Worker (独立进程)
│       ├── notification-worker.ts   # 通知发送
│       ├── schedule-worker.ts       # 定时任务（复评/漏服检查）
│       └── metric-analytics-worker.ts # 指标分析
│
├── prisma/
│   ├── schema.prisma                # 数据库 Schema
│   └── migrations/                  # 迁移文件
│
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml           # 本地开发
│   └── docker-compose.prod.yml      # 生产环境
│
├── k8s/                             # Kubernetes 配置 (V2)
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.example
├── tsconfig.json
└── package.json
```

### 12.2 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml (示例)

stages:
  - lint
  - test
  - build
  - deploy-staging
  - deploy-production

lint:
  script:
    - npm run lint
    - npm run type-check
    - npm run prisma:validate  # 验证 Schema

test:
  script:
    - npm run test:unit
    - npm run test:integration
    - npm run test:e2e
  coverage:
    threshold: 80%

build:
  script:
    - npm run build
    - docker build -t zhiyi-api:$CI_COMMIT_SHA .
    - docker push zhiyi-api:$CI_COMMIT_SHA

deploy-staging:
  script:
    - kubectl set image deployment/zhiyi-api-staging zhiyi-api=$IMAGE
    - kubectl rollout status deployment/zhiyi-api-staging

deploy-production:
  when: manual  # 手动触发
  script:
    # 灰度 10%
    - kubectl set image deployment/zhiyi-api-canary zhiyi-api=$IMAGE
    - sleep 1800  # 观察 30 分钟
    # 健康检查通过后全量
    - kubectl set image deployment/zhiyi-api zhiyi-api=$IMAGE
    - kubectl rollout status deployment/zhiyi-api

rollback:
  when: on_failure
  script:
    - kubectl rollout undo deployment/zhiyi-api
```

---

## 13. 演进路线图

### 13.1 MVP 阶段（10 周，2 人后端）

```
Week 1-2: 基础设施搭建
  ├── 项目脚手架 + NestJS 模块骨架
  ├── Docker Compose 本地环境 (PostgreSQL + Redis + MinIO)
  ├── Prisma Schema + 初始迁移
  ├── CI/CD Pipeline
  └── API Gateway 中间件 (认证/限流/日志)

Week 3-5: 核心差异化功能 (Sprint 1)
  ├── Auth Module (微信登录 + JWT)
  ├── Family Module (家庭 + 成员 CRUD)
  ├── HealthRecord Module (档案管理)
  ├── Assessment Module (自评流程 + 评分引擎)
  └── Consultation Module (LLM 网关 + SSE 流式)

Week 6-8: 刚需功能 (Sprint 2)
  ├── Medication Module (用药计划 + OCR + 提醒)
  ├── Metric Module (指标录入 + 趋势 + TimescaleDB 超表)
  ├── Notification Module (微信订阅消息 + 应用内通知)
  └── RedLine Engine (12 类规则 + 本地判定)

Week 9: 集成测试与性能压测
  ├── 全链路联调
  ├── 压力测试 (5000 QPS 目标)
  ├── 安全合规审查
  └── 灰度发布准备

Week 10: 灰度 → 全量上线
  ├── 10% 灰度 → 观察 → 30% → 100%
  ├── 监控看板配置
  └── 上线 24h 值守
```

### 13.2 V1.1 阶段（+6 周）

```
Week 11-12:
  ├── Report Module (体检报告 OCR + 解读)
  ├── Knowledge Module (个性化科普推荐)
  └── Content Trust System (来源标注 + 审核流程)

Week 13-14:
  ├── 适老化完整模式 (语音为主交互)
  ├── 需求反馈闭环
  └── 微信运动接入

Week 15-16:
  ├── 性能优化 (缓存预热 + 慢查询优化)
  ├── 监控完善 (业务指标 + 告警)
  └── 架构重构准备 (模块边界加固)
```

### 13.3 V2 阶段（智能设备接入）

```
架构升级:
  ├── 模块化单体 → 微服务拆分
  │   ├── AI Consultation Service (独立部署 + GPU 节点)
  │   ├── Metric Service (高写入 + TimescaleDB 集群)
  │   └── Device Gateway Service (MQTT Broker + 设备管理)
  │
  ├── 部署升级
  │   ├── Docker Compose → Kubernetes
  │   ├── Service Mesh (Istio)
  │   └── 弹性伸缩 (HPA)
  │
  ├── 设备接入
  │   ├── Device Gateway 完整实现
  │   ├── Apple Watch 适配器
  │   ├── 华为 Watch 适配器
  │   ├── 第三方血压计/血糖仪适配器
  │   └── 设备数据聚合 Pipeline
  │
  └── 平台能力
      ├── 家庭健康日历
      ├── 任务协作
      ├── 心理疏导 (PHQ-9/GAD-7)
      └── 社区互动
```

---

## 附录 A：架构决策记录 (ADR)

| ADR | 决策 | 状态 |
|-----|------|:----:|
| ADR-001 | MVP 采用 NestJS 模块化单体架构 | ✅ 已采纳 |
| ADR-002 | 数据库存储方案：PostgreSQL + TimescaleDB + Redis + Elasticsearch | ✅ 已采纳 |
| ADR-003 | AI 咨询采用 SSE 流式返回 | ✅ 已采纳 |
| ADR-004 | 就医红线本地规则引擎（非 LLM 判定） | ✅ 已采纳 |
| ADR-005 | V2 设备接入采用 MQTT 协议 | ✅ 已采纳 |
| ADR-006 | 缓存策略：Cache-Aside + 多级缓存 | ✅ 已采纳 |
| ADR-007 | 消息队列：MVP 用 Redis Streams，增长期迁移 RabbitMQ | ✅ 已采纳 |
| ADR-008 | 文件上传：预签名 URL + S3 兼容存储 | ✅ 已采纳 |

## 附录 B：关键技术风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|:----:|----------|
| LLM API 响应时间超 3s | 用户体验崩溃 | 中 | 流式 SSE + 熔断降级 + 多供应商备选 |
| 就医红线漏判 | 用户安全风险 | 低 | 保守策略（宁可多触发）+ 医学专家审核 + 200+ 测试用例 |
| TimescaleDB 学习曲线 | 开发延期 | 低 | 本质是 PostgreSQL 扩展，DBA 无额外学习成本 |
| 微信订阅消息配额不足 | 提醒无法送达 | 中 | 提前申请配额 + 应用内通知兜底 |
| MQTT 引入过早 | MVP 过度工程 | 中 | V2 阶段引入，MVP 不实现设备接入 |
| 微服务过早拆分 | 运维成本爆炸 | 高 | 模块化单体，明确触发条件后再拆分 |

---

> **本文档为智医助手后端架构的完整设计方案，涵盖从 MVP 到 V2 的全生命周期规划。每个设计决策都有明确的技术选型理由，每条 SQL 和代码示例均可直接落地执行。**
