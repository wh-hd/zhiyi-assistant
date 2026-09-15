# 智医助手 — Docker 全栈启动流程 (TiDB Cloud + Ollama GPU)

> 数据库: TiDB Cloud MySQL (外部云数据库)  
> 本地服务: Redis + MinIO + Ollama (NEXUS-Medical LLM) + NestJS API  
> 更新日期: 2026-07-08

---

## 前置条件

1. **Docker Desktop** 已安装并运行（带 NVIDIA GPU 支持）
2. **TiDB Cloud** 账号已激活，连接信息：
   - 主机: `your-instance.tidbcloud.com:4000`
   - 用户: `YOUR_TIDB_USER`
   - 数据库: `zhiyi_dev`（已自动创建，⚠️ 不能用 `sys` 系统数据库）
3. **NVIDIA GPU** 驱动正常（`nvidia-smi` 可运行）
4. 网络可访问外网（TiDB Cloud 在 AWS EU-central-1）

---

## 启动流程

### Step 1: 停止旧服务 & 清理旧容器

```bash
cd deliverables/backend

# 停止所有旧容器
docker compose down

# 清理旧的 PostgreSQL 卷（已不再需要）
docker volume rm zhiyi_postgres_data 2>/dev/null

# 确认没有残留容器
docker compose ps
```

### Step 2: 构建并启动全栈

```bash
# 构建镜像 + 启动所有服务（首次需要 3-5 分钟）
docker compose up -d --build
```

此命令会依次启动：
1. **Redis** — 缓存/会话/限流
2. **MinIO** — 对象存储 + 自动创建 bucket
3. **Ollama** — GPU LLM 推理引擎
4. **ollama-setup** — 拉取 NEXUS-Medical 模型（~1GB，首次需要几分钟）
5. **API** — NestJS 后端（等待 Redis + Ollama 就绪后启动）

### Step 3: 监控启动进度

```bash
# 实时查看 API 启动日志（重点看 Prisma db push 和 seed）
docker compose logs -f api

# 或查看所有服务状态
docker compose ps
```

**API 启动成功的标志**：
```
============================================
  Starting NestJS application...
  Port: 3000
  Swagger: http://localhost:3000/api/docs
============================================
[Nest] LOG [PrismaService] Prisma 数据库连接已建立
[Nest] LOG Nest application successfully started
```

### Step 4: 验证服务健康

```bash
# 1. API 健康检查
curl http://localhost:3000/health
# 期望: {"status":"ok","service":"智医助手 API","version":"0.1.0"}

# 2. Ollama 模型检查
curl http://localhost:11434/api/tags
# 期望: 包含 fableforge-ai/nexus-medical:q4_k_m

# 3. Redis 检查
docker exec zhiyi-redis redis-cli -a "$REDIS_PASSWORD" ping
# 期望: PONG

# 4. MinIO 控制台
# 浏览器访问: http://localhost:9001 (用户/密码见 .env)
```

### Step 5: 测试核心功能

```bash
# 1. 微信登录（开发模式，code=xiaolin 直接返回种子用户）
curl -X POST http://localhost:3000/v1/auth/wechat-login \
  -H "Content-Type: application/json" \
  -d '{"code":"xiaolin"}'
# 期望: 返回 accessToken + refreshToken

# 2. AI 健康咨询（替换 <TOKEN> 为上一步获取的 accessToken）
curl -N -X POST http://localhost:3000/v1/consultations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"query":"最近总是感觉疲惫，睡眠不好，怎么办？","familyId":"f-001","memberId":"m-000"}'
# 期望: SSE 流式返回 — disclaimer 事件 → 多个 chunk 事件 → done 事件

# 3. 红线引擎测试（胸痛 + 冷汗 → 触发立即就医建议）
curl -N -X POST http://localhost:3000/v1/consultations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"query":"胸痛，还出冷汗","familyId":"f-001","memberId":"m-000"}'
# 期望: redLine 事件 triggered=true, severity=immediate
```

---

## 架构变更说明

### 数据库: PostgreSQL → TiDB Cloud MySQL

| 项目 | 变更前 | 变更后 |
|------|--------|--------|
| 数据库引擎 | PostgreSQL 17 + TimescaleDB | TiDB Cloud (MySQL 兼容) |
| 部署方式 | Docker 容器 (本地) | 外部云数据库 (AWS EU) |
| Prisma provider | `postgresql` | `mysql` |
| 连接串 | `postgresql://...@postgres:5432/...` | `mysql://...@your-instance.tidbcloud.com:4000/sys?sslaccept=accept` |
| 长文本字段 | `TEXT` (PostgreSQL 默认) | `@db.Text` (MySQL 需显式声明) |
| 迁移文件 | SQLite 旧迁移 | 已删除，使用 `prisma db push` |

### 保留的 Docker 服务

| 服务 | 用途 | 端口 |
|------|------|------|
| Redis 7 | 缓存/会话/限流 | 6379 |
| MinIO | 对象存储 (头像/OCR/导出) | 9000, 9001 |
| Ollama | 本地 GPU LLM 推理 | 11434 |
| NestJS API | 后端 API 服务 | 3000 |

---

## 潜在问题 & 排查

### 问题 1: TiDB Cloud 连接失败

**症状**: API 日志显示 `Prisma db push failed` 或 `Cannot reach TiDB Cloud`

**排查**:
```bash
# 从 Docker 容器内测试 TiDB Cloud 连通性
docker exec zhiyi-api node -e "
const net = require('net');
const socket = new net.Socket();
socket.setTimeout(10000);
socket.on('connect', () => { console.log('OK: TiDB Cloud reachable'); socket.destroy(); });
socket.on('error', (e) => { console.log('FAIL:', e.message); });
socket.on('timeout', () => { console.log('TIMEOUT'); socket.destroy(); });
socket.connect(4000, 'your-instance.tidbcloud.com');
"
```

**解决方案**:
- 如果网络不通，在 docker-compose.yml 的 api 服务中添加代理环境变量：
  ```yaml
  environment:
    HTTP_PROXY: 'http://host.docker.internal:7897'
    HTTPS_PROXY: 'http://host.docker.internal:7897'
    NO_PROXY: 'localhost,127.0.0.1,redis,minio,ollama'
  ```
- 如果 TLS 证书问题，尝试将连接串中的 `sslaccept=accept` 改为 `sslaccept=require`

### 问题 2: `sys` 数据库权限不足

**症状**: `prisma db push` 报错 `CREATE TABLE permission denied` 或 `Access denied`

**原因**: TiDB Cloud 的 `sys` 可能是系统数据库，不允许创建用户表

**解决方案**: 在 TiDB Cloud 控制台创建专用数据库，然后更新连接串：
```bash
# 1. 通过 TiDB Cloud SQL 编辑器执行:
CREATE DATABASE IF NOT EXISTS zhiyi_dev;

# 2. 更新 docker-compose.yml 和 .env 中的 DATABASE_URL:
# mysql://...@your-instance.tidbcloud.com:4000/zhiyi_dev?sslaccept=accept&connection_limit=10

# 3. 重启 API:
docker compose restart api
```

### 问题 3: TEXT 字段 DEFAULT 值错误

**症状**: `prisma db push` 报错 `BLOB/TEXT column cannot have a default value`

**原因**: 部分 MySQL/TiDB 版本不支持 TEXT 列的 DEFAULT 子句

**解决方案**: 将 `@db.Text` 改为 `@db.VarChar(4000)`（支持 DEFAULT）：
```prisma
# 修改前:
chronicDiseases String  @default("[]") @db.Text
# 修改后:
chronicDiseases String  @default("[]") @db.VarChar(4000)
```

### 问题 4: 外键约束创建失败

**症状**: `prisma db push` 报错 `Cannot add foreign key constraint`

**原因**: TiDB 旧版本不支持外键，或 FK 语法不兼容

**解决方案**: 从 schema.prisma 中移除所有 `onDelete: Cascade`，在应用层处理级联删除：
```prisma
# 修改前:
member FamilyMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
# 修改后:
member FamilyMember @relation(fields: [memberId], references: [id])
```
然后在各 Service 的 `delete` 方法中手动删除关联数据。

### 问题 5: Ollama 模型拉取失败

**症状**: `ollama-setup` 容器日志显示 pull 失败

**排查**:
```bash
docker logs zhiyi-ollama-setup
```

**解决方案**:
```bash
# 手动拉取模型
docker exec zhiyi-ollama ollama pull fableforge-ai/nexus-medical:q4_k_m

# 如果仍然失败，使用回退模型
docker exec zhiyi-ollama ollama pull qwen2.5:1.5b
```

### 问题 6: GPU 不可用

**症状**: Ollama 容器日志显示 `CUDA error` 或 GPU 未检测到

**排查**:
```bash
# 检查 Docker GPU 直通
docker exec zhiyi-ollama nvidia-smi
```

**解决方案**:
- 确保 Docker Desktop 设置中启用了 NVIDIA GPU
- 确保 `nvidia-smi` 在宿主机可运行
- 如果 GPU 不可用，Ollama 会自动回退到 CPU 推理（速度较慢但功能正常）

---

## 常用运维命令

```bash
# 查看所有服务状态
docker compose ps

# 查看 API 日志（实时）
docker compose logs -f api

# 重启单个服务
docker compose restart api

# 重新构建 API（代码变更后）
docker compose up -d --build api

# 停止所有服务
docker compose down

# 停止并清理所有数据卷（⚠️ 会丢失数据）
docker compose down -v

# 进入 API 容器
docker exec -it zhiyi-api sh

# 容器内重新编译 TypeScript（开发模式）
docker exec zhiyi-api npx nest build && docker compose restart api

# Prisma Studio（可视化数据库管理）
docker exec zhiyi-api npx prisma studio
# 然后访问 http://localhost:5555
```

---

## 环境变量速查

| 变量 | 值 | 说明 |
|------|------|------|
| `DATABASE_URL` | `mysql://YOUR_TIDB_USER:****@your-instance.tidbcloud.com:4000/zhiyi_dev?sslaccept=accept&connection_limit=10` | TiDB Cloud MySQL 连接 |
| `LLM_MODEL` | `fableforge-ai/nexus-medical:q4_k_m` | NEXUS-Medical 1.5B Q4 |
| `LLM_BASE_URL` | `http://ollama:11434` | Ollama API (容器内) |
| `REDIS_HOST` | `redis` | Redis 容器 |
| `OSS_ENDPOINT` | `minio` | MinIO 容器 |
| `JWT_SECRET` | `dev-jwt-secret-...` | ⚠️ 生产环境必须更换 |
