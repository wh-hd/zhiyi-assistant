<div align="center">

# 智医助手 · ZhiYi Assistant

**AI 驱动的家庭健康管理助手**

健康咨询 · 智能健康自评 · 家庭健康档案 · 习惯养成

> ⚕️ 本项目为**健康管理工具**，提供健康科普、健康自评与健康运营，**不做诊断、不替代医生**。紧急就医症状会触发「就医红线」直接给出求医建议。

[![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey.svg)](#-许可)
[![Node](https://img.shields.io/badge/node-22.x-339933.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E.svg)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748.svg)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://docs.docker.com/compose/)

</div>

---

## 📖 目录

- [一、项目简介](#一项目简介)
- [二、核心特性](#二核心特性)
- [三、技术栈](#三技术栈)
- [四、系统架构](#四系统架构)
- [五、目录结构](#五目录结构)
- [六、快速开始（Docker 全栈一键部署）](#六快速开始docker-全栈一键部署)
- [七、环境镜像与依赖清单](#七环境镜像与依赖清单)
- [八、环境变量说明](#八环境变量说明)
- [九、本地 LLM（Ollama）](#九本地-llmollama)
- [十、数据库说明](#十数据库说明)
- [十一、API 概览](#十一api-概览)
- [十二、常用运维命令](#十二常用运维命令)
- [十三、安全与隐私](#十三安全与隐私)
- [十四、已知限制与 Roadmap](#十四已知限制与-roadmap)
- [十五、许可](#十五许可)

---

## 一、项目简介

**智医助手** 是一款面向家庭健康决策者（25–45 岁，女性为主）的 AI 家庭健康助手。它不做诊疗，而是围绕「**帮家里每个人把健康管起来**」这件事，提供从**健康自评 → 健康档案 → 日常指标 → AI 咨询 → 用药提醒 → 健康报告**的闭环。

项目最初面向微信小程序设计，后出于「**私有化自托管、数据不出本机**」的诉求，落地为 **Web / PWA + NestJS 后端 + 本地 LLM** 的形态——一条 `docker compose` 命令即可在本地或局域网启动全栈服务，**免域名、免备案、免公网 HTTPS**。

- **产品定位**：家庭健康管理（非诊疗），紧急症状转「就医红线」提示
- **核心用户**：家庭健康决策者
- **核心差异化**：AI 驱动的智能健康自评体系 + 家庭健康档案
- **部署形态**：私有化自托管（本机 / 局域网）

---

## 二、核心特性

| 模块 | 能力 |
|------|------|
| **健康自评** | 随机抽题（10 题）→ 打分（10 分制）→ 分类得分 + 关注点 + 雷达图，结果落库并回写成员档案 |
| **家庭健康档案** | 家庭成员管理、血型/身高体重、慢病/过敏/手术/家族史/疫苗接种等长文本档案 |
| **健康指标** | 血压/血糖/体脂/心率/血氧/体温/步数/睡眠/压力等时序记录，阈值判定 + 连续异常预警 |
| **AI 健康咨询** | SSE 流式对话，基于成员健康画像生成建议；本地**就医红线规则引擎**（<5ms）拦截紧急症状 |
| **用药管理** | 用药计划、服药依从性打卡、漏服提醒 |
| **健康报告** | 周期性/咨询汇总报告（PDF 生成能力） |
| **待办事项** | 家庭健康待办（关联成员、截止时间、完成打卡） |
| **账号体系** | 邮箱注册/登录（bcrypt 密码哈希 + JWT access/refresh），多设备 refresh token 可撤销 |
| **安全设计** | 就医红线本地判定、自伤检测转人工、非诊疗声明、速率限制、Helmet CSP |

---

## 三、技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| **前端** | 单文件 PWA 原型（原生 JS + CSS，SoftCare 设计系统） | — |
| **后端框架** | NestJS（模块化单体） | 11.x |
| **运行时** | Node.js | 22.x |
| **语言** | TypeScript | 5.8 |
| **ORM** | Prisma | 6.17 |
| **数据库** | MySQL 协议（TiDB Cloud / 本地 MySQL） | 8.0+ |
| **缓存** | Redis | 7.x |
| **对象存储** | MinIO | latest |
| **本地 LLM** | Ollama + NEXUS-Medical（Qwen2.5-1.5B Q4_K_M） | latest |
| **鉴权** | Passport-JWT + bcryptjs | — |
| **接口文档** | Swagger（`/api/docs`，非生产环境） | — |
| **部署** | Docker Compose | v2 |

---

## 四、系统架构

```
                        ┌──────────────────────────────┐
                        │        浏览器 / PWA           │
                        │  prototype.html（单文件前端）  │
                        └───────────────┬──────────────┘
                                        │ 同源 /v1（相对路径）
                                        ▼
┌───────────────────────────────────────────────────────────────────┐
│                        NestJS API (容器, :3000)                     │
│  ┌─────────┐ ┌─────────┐ ┌───────────┐ ┌────────────┐ ┌─────────┐  │
│  │  Auth   │ │ Family  │ │ Assessment│ │Consultation│ │ Metric  │  │
│  └─────────┘ └─────────┘ └───────────┘ └─────┬──────┘ └─────────┘  │
│  ... medication / task / notification / report / knowledge / upload  │
│                                                                     │
│  共享层: Prisma · Cache(Redis) · EventBus · LLM-Gateway · RedLine    │
└───────┬───────────────┬──────────────┬───────────────┬─────────────┘
        │               │              │               │
        ▼               ▼              ▼               ▼
   ┌─────────┐    ┌──────────┐   ┌──────────┐    ┌──────────────┐
   │  Redis  │    │  MinIO   │   │  Ollama  │    │  TiDB Cloud  │
   │ :6379   │    │:9000/9001│   │ :11434   │    │ MySQL 协议    │
   │ 缓存/限流│    │ 对象存储  │   │ 本地 LLM │    │ (外部依赖)    │
   └─────────┘    └──────────┘   └──────────┘    └──────────────┘
        ▲               ▲              ▲
        └───────────────┴──────────────┘
              internal 网络（不出宿主机）
```

- **单入口**：前端静态资源由 NestJS `useStaticAssets` 直接托管，API 与页面同源（`:3000`），规避 CORS / CSP 问题。
- **数据库外置**：TiDB Cloud（或任意 MySQL），通过 `DATABASE_URL` 连接，需在云端加白名单。
- **LLM 本地化**：Ollama 容器内置 NEXUS-Medical 医疗小模型，推理不出本机；未就绪时走安全兜底。

---

## 五、目录结构

```
智医助手/
├── README.md                     # 本文件
├── overview.md                   # 项目交付总览
├── .gitignore
└── deliverables/
    ├── product-strategy/         # 产品调研大纲 + PRD
    ├── frontend/                 # 前端原型设计源（独立版）+ 设计系统规范
    │   ├── DESIGN-SYSTEM.md      #   SoftCare 设计系统
    │   └── zhiyi-assistant-prototype.{html,css,js}
    ├── backend/                  # 后端与部署（核心可运行部分）
    │   ├── docker-compose.yml        #   ★ 全栈编排（redis/minio/ollama/api）
    │   ├── docker-compose.gpu.yml    #   GPU 覆盖文件（启动器自动合并）
    │   ├── docker-compose.dev.yml    #   本地开发端口映射
    │   ├── .env.example              #   环境变量模板（复制为 .env）
    │   ├── start_server.bat          #   Windows 一键启动
    │   ├── start-zhiyi.sh            #   Linux/macOS 一键启动
    │   ├── ollama-entrypoint.sh      #   Ollama 模型自动拉取
    │   ├── PRIVATE-DEPLOY.md         #   私有化部署说明
    │   ├── STARTUP-GUIDE.md          #   启动与排错指南
    │   └── nestjs/                   #   ★ NestJS 后端工程
    │       ├── src/                  #     源码（12 个业务模块 + 共享层）
    │       ├── prisma/schema.prisma  #     数据模型（15 张表）
    │       ├── public/               #     ★ 运行时前端（prototype.html + js/css）
    │       ├── Dockerfile            #     多阶段构建
    │       └── docker-entrypoint.sh  #     启动自动对齐库结构
    ├── release-hardening/        # 加固阶段架构与 PRD
    ├── migration/                # 迁移方案与部署就绪审计
    └── CODE-AUDIT-*.md / FIX-*.md # 代码审计与修复记录
```

> 说明：`backend/nestjs/public/` 是**运行时实际托管**的前端（由网关同源提供）；`frontend/` 为早期独立设计源，供参考。

---

## 六、快速开始（Docker 全栈一键部署）

### 前置条件

- **Docker Desktop**（Windows / macOS）或 **Docker Engine + Compose v2**（Linux）
- 一个可连接的 **MySQL 协议数据库**（默认对接 TiDB Cloud；本地 MySQL 亦可）
- （可选）**NVIDIA GPU** 及驱动 + `nvidia-container-toolkit`，用于本地 LLM 加速；无 GPU 自动回落 CPU
- 若使用 TiDB Cloud，需把**部署机器出口 IP 加入集群白名单**

### 1. 获取代码

```bash
git clone git@github.com:wh-hd/zhiyi-assistant.git
cd zhiyi-assistant/deliverables/backend
```

### 2. 配置环境变量

复制模板并**只改必填项**：

```bash
# Windows
copy .env.example .env
# macOS / Linux
cp .env.example .env
```

编辑 `.env`，至少修改：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | 数据库连接串，如 `mysql://user:pass@host:4000/zhiyi_dev?sslaccept=accept` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 生产环境务必替换为 64 位随机串 |

> 其余变量（Redis / MinIO / CORS 等）已内置私有化默认值，一般无需改动。

### 3. 启动

**方式 A（Windows，一键）**：双击 `start_server.bat` —— 自动探测 GPU、拉起 Docker、等待健康检查、打开浏览器。

**方式 B（命令行，通用）**：

```bash
# 有 NVIDIA GPU（自动透传）
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build

# 无 GPU（纯 CPU）
docker compose up -d --build
```

> Linux / macOS 可直接用 `./start-zhiyi.sh`，脚本会自动判断是否有 GPU 并选择对应 compose 组合。

首次启动会：构建 API 镜像 → 启动 Redis / MinIO / Ollama → **自动拉取 NEXUS-Medical 模型（约 1GB）** → 入口脚本自动 `prisma db push` 对齐库结构 → 启动 API。整个过程约 3–8 分钟。

### 4. 验证

```bash
# 健康检查
curl http://localhost:3000/health
# → {"status":"ok","service":"智医助手 API",...}

# 查看容器状态
docker compose ps
```

| 访问项 | 地址 |
|--------|------|
| **应用前端** | http://localhost:3000/prototype.html |
| **接口文档（Swagger）** | http://localhost:3000/api/docs |
| **健康检查** | http://localhost:3000/health |
| **MinIO 控制台** | http://localhost:9001（需用 `docker-compose.dev.yml` 发布端口） |

首次打开会要求**注册账号**（邮箱唯一 + 8 位以上密码），注册后即可使用。

**局域网其他设备访问**：放行 3000 端口后，用 `http://<本机局域网IP>:3000/prototype.html` 打开即可。

---

## 七、环境镜像与依赖清单

### Docker 镜像

| 服务 | 镜像 | 版本策略 | 宿主机端口 | 说明 |
|------|------|----------|------------|------|
| **API** | 本地构建（`nestjs/Dockerfile`） | 源码构建 | `3000:3000` | NestJS 后端 + 前端静态托管 |
| **Redis** | `redis:7-alpine` | 固定主版本 | 仅内部网络 | 缓存 / 限流 / 会话 |
| **MinIO** | `minio/minio:latest` | latest | 仅内部网络 | 对象存储（头像 / 文件） |
| **Ollama** | `ollama/ollama:latest` | latest | 仅内部网络 | 本地 LLM 推理 |

> 正式 `docker-compose.yml` 仅把 **API 的 3000 端口**发布到宿主机，Redis / MinIO / Ollama 均在 `internal` 网络内，不对宿主机暴露，避免端口占用与误访问。需要在本机调试 MinIO / Ollama 时，叠加 `docker-compose.dev.yml`（端口绑定到 `127.0.0.1`）：
> ```bash
> docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
> ```

### API 镜像构建（多阶段）

`nestjs/Dockerfile` 采用两阶段构建：

| 阶段 | 基础镜像 | 动作 |
|------|----------|------|
| **builder** | `node:22-slim` | `npm ci` → `prisma generate` → `nest build` |
| **runner** | `node:22-slim` | 仅拷贝 `dist` + `public` + 生产依赖，以非 root 用户 `node` 运行 |

### 关键依赖版本

- **运行时**：Node.js 22（`node:22-slim`）
- **后端核心**：`@nestjs/*@11`、`@prisma/client@6.17`、`ioredis@5`、`bcryptjs@2`、`helmet@8`、`pdfkit@0.19`、`zod@3`
- **数据模型**：Prisma Schema 定义 **15 张表**（users / families / family_members / health_records / assessments / consultations / medication_plans / health_metrics / notifications / knowledge / health_reports / tasks 等）

---

## 八、环境变量说明

在 `deliverables/backend/.env` 中配置（由 `docker-compose.yml` 注入容器）：

| 变量 | 必填 | 说明 |
|------|:----:|------|
| `DATABASE_URL` | ✅ | MySQL/TiDB 连接串 |
| `JWT_ACCESS_SECRET` | ✅ | Access Token 签名密钥（≥64 位随机串） |
| `JWT_REFRESH_SECRET` | ✅ | Refresh Token 签名密钥（≥64 位随机串） |
| `REDIS_PASSWORD` | ✅ | Redis 密码（容器内部） |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | ✅ | MinIO 账号（默认 `zhiyi_admin` / 私有默认值） |
| `NODE_ENV` | | 默认 `production`（容器内） |
| `CORS_ORIGINS` | | 允许的跨域来源，逗号分隔 |
| `LLM_BASE_URL` | | Ollama 地址，容器内为 `http://ollama:11434` |
| `OLLAMA_MODEL` / `LLM_MODEL` | | 模型名，默认 `fableforge-ai/nexus-medical:q4_k_m` |
| `UPLOAD_ENABLED` | | 是否启用文件上传（默认 `false`） |
| `SECURITY_ALERT_CHANNEL` | | 安全告警通道（`log` / `webhook`） |
| `ADMIN_USER_IDS` | | 管理员用户 ID（逗号分隔，用于写权限鉴权） |

> 完整字段见 `deliverables/backend/.env.example`。

---

## 九、本地 LLM（Ollama）

- **默认模型**：`fableforge-ai/nexus-medical:q4_k_m`（NEXUS-Medical，基于 Qwen2.5-1.5B，Q4_K_M 量化，约 986MB）
- **兜底模型**：`qwen2.5:1.5b`
- **自动拉取**：`ollama-entrypoint.sh` 在容器首次启动时自动拉取模型；Ollama registry 失败则回退 HuggingFace 源（`hf.co/fableforge-ai/NEXUS-Medical`）。
- **GPU 自动探测**：`start_server.bat` / `start-zhiyi.sh` 检测到 `nvidia-smi` 即合并 `docker-compose.gpu.yml` 透传 GPU，否则以 CPU 运行。
- **手动拉取**：
  ```bash
  docker exec -it <ollama容器> ollama pull fableforge-ai/nexus-medical:q4_k_m
  ```
- **模型未就绪时**：AI 咨询走内置安全兜底，功能不中断。

> ⚠️ NEXUS-Medical 为 1.5B 小模型，复杂 prompt 下输出质量有限，可自行替换为 7B+ 模型（修改 `LLM_MODEL` 并 `ollama pull`）。

---

## 十、数据库说明

- **协议**：MySQL（Prisma `provider = "mysql"`）
- **默认云库**：TiDB Cloud（`*.tidbcloud.com:4000`）；也可用本地 MySQL 8
- **建库**：需使用**专用数据库**（如 `zhiyi_dev`），**不要用 `sys` 等系统库**
- **结构对齐**：容器启动时入口脚本自动执行
  ```bash
  prisma db push --skip-generate --accept-data-loss
  ```
  直接比对 schema 与库结构并增量修正（幂等、可重复执行），无需手动跑 SQL。
- **长文本字段**：`health_records` 的病史/过敏/手术/家族史/疫苗等字段为 `@db.Text`，超长内容不会 500（历史迁移已废弃，改用 `db push` 作为唯一事实来源）。
- **白名单**：若用 TiDB Cloud，需在控制台把部署机器出口 IP 加入白名单。

---

## 十一、API 概览

所有业务接口以 `/v1` 为前缀，健康检查 `/health` 除外。认证方式为 `Authorization: Bearer <accessToken>`。

| 模块 | 端点（节选） |
|------|--------------|
| **Auth** | `POST /v1/auth/register`、`POST /v1/auth/login`、`POST /v1/auth/refresh`、`POST /v1/auth/logout` |
| **User** | `GET /v1/users/me`、`GET /v1/users/me/stats` |
| **Family** | `GET/POST/PATCH/DELETE /v1/families`、成员 CRUD |
| **Assessment** | `POST /v1/assessments/start`、`POST /v1/assessments/:id/submit`、历史查询 |
| **Consultation** | `POST /v1/consultations`（**SSE 流式**）、历史查询 |
| **Metric** | `POST /v1/metrics`、按类型/成员查询、阈值配置 |
| **Medication** | 用药计划 CRUD、依从性打卡 |
| **Task** | `GET/POST/PATCH/DELETE /v1/tasks` |
| **Report** | 生成/查询健康报告 |
| **Knowledge** | 健康知识库查询 |

> 完整接口与模型定义见 Swagger：`http://localhost:3000/api/docs`（非生产环境自动开启）。

**SSE 流式咨询示例**：

```bash
curl -N -X POST http://localhost:3000/v1/consultations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"query":"最近总是疲惫、睡眠不好，怎么办？","familyId":"<fid>","memberId":"<mid>"}'
# 事件流：disclaimer → chunk(chunk...) → done
```

---

## 十二、常用运维命令

```bash
cd deliverables/backend

# 查看服务状态
docker compose ps

# 实时查看 API 日志
docker compose logs -f api

# 代码变更后重建 API
docker compose up -d --build api

# 重启单个服务
docker compose restart api

# 停止全部服务
docker compose down

# 停止并清理数据卷（⚠️ 丢失本机卷数据）
docker compose down -v

# 进入 API 容器
docker exec -it zhiyi-api sh
```

---

## 十三、安全与隐私

- **数据不出本机**：LLM 推理在本地 Ollama 完成，健康数据存储于你自己的数据库。
- **密钥隔离**：所有真实密钥/连接串仅存于 `.env`（已在 `.gitignore` 中排除），仓库只提交 `.env.example` 模板。
- **就医红线**：紧急症状（如胸痛+冷汗、自伤表达）由**本地规则引擎**（<5ms，18 条规则）即时拦截并给出就医建议，不依赖外部服务。
- **应用安全**：Helmet CSP、全局速率限制（Throttler）、入参校验（class-validator，`whitelist` + 禁止非白名单字段）、JWT 双 token、密码 bcrypt 哈希。
- **非诊疗声明**：AI 咨询输出附免责声明，明确不构成医疗诊断。

> ⚠️ 提交到公开仓库前，请确认无任何真实密钥被提交；若 `DATABASE_URL` 等曾以明文出现在历史中，应立即在数据库侧轮换密码。

---

## 十四、已知限制与 Roadmap

**当前限制**

- AI 模型为 1.5B 小模型，复杂问答质量有限（可换 7B+）
- 微信订阅消息推送、AI 用药识别 / 体检报告 OCR 为降级实现
- PDF 报告中文需额外配置字体（`PDF_FONT_PATH`）
- 未内置公网 HTTPS / 域名（私有化自托管定位）

**Roadmap**

- [ ] 接入 7B+ 医疗模型，提升咨询质量
- [ ] 微信订阅消息推送打通
- [ ] 用药识别 / 体检报告 OCR（视觉模型）
- [ ] 健康档案迁移至一次性幂等迁移（替代 `db push`）

---

## 十五、许可

本项目为**私有项目**，保留所有权利（`UNLICENSED`）。未经授权请勿用于商业用途。

<div align="center">
<sub>智医助手 · 让每个家庭都有一位懂健康的 AI 助手</sub>
</div>
