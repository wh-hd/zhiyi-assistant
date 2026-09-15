# 智医助手 · 私有化自托管部署（博客式）

像跑一个 Docker 博客程序一样：一条命令起全栈，本机/局域网自访，**免域名、免备案、免公网 HTTPS**。

## 前提
- 安装 Docker Desktop（Windows/Mac）或 Docker Engine + Compose V2（Linux）
- 一个可连接的数据库（当前默认 TiDB Cloud / MySQL 协议），连接串填进 `.env` 的 `DATABASE_URL`
  - 本地 MySQL 也可：`DATABASE_URL=mysql://用户:密码@127.0.0.1:3306/zhiyi_dev`（库需先建好）

## 三步起服务
1. 复制配置模板（在 `deliverables/backend/` 目录）：
   - Windows：`copy .env.example .env`
   - Mac/Linux：`cp .env.example .env`
2. 编辑 `.env`，**只改必填项**：
   - `DATABASE_URL` —— 改成你的 TiDB Cloud / 本地 MySQL 连接串
   - 其余变量已填好私有化默认值（Redis/MinIO/JWT/CORS 等），一般无需动
3. 启动（二选一）：
   - 双击 `start_server.bat`（Windows：自动拉起 Docker、等健康、开浏览器）
   - 命令行：`docker compose up -d --build`

## 访问地址
- 应用原型：http://localhost:3000/prototype.html
- 接口文档：http://localhost:3000/api/docs
- 健康检查：http://localhost:3000/health
- MinIO 控制台：http://localhost:9001 （用户/密码见 `.env` 的 `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`）

首次打开会要求**注册一个账号**（账号密码登录、邮箱唯一），注册后即用。

## 局域网其他设备访问
- 确认防火墙放行 3000 端口
- 手机/其他电脑浏览器打开 `http://<本机局域网IP>:3000/prototype.html`
- Ollama 在容器内，局域网设备经 API 间接使用 AI 咨询，无需额外配置

## 你仍需手动的两步（连真实库 / 账号相关）
代码层已全部就绪，只剩这两步需你在本机操作：
1. **填连接串**：把 `.env` 的 `DATABASE_URL` 改成你的 TiDB Cloud / 本地 MySQL 连接串。
2. **加白名单**：若用 TiDB Cloud，把部署机器出口 IP 加入集群白名单，否则连不上库。

> 之前需手动执行的「M3 长文本迁移」现已自动化：服务启动时入口脚本会自动跑
> `prisma db push`，把 `health_records` 等超长字段列对齐为 TEXT，**超长病史/过敏写入不再 500**。
> 你无需再连库跑任何 SQL。

## 已知注意（不影响自访使用）
- **Ollama 本地 LLM**：启动器（`start_server.bat` / `start-zhiyi.sh`）会**自动探测宿主机 NVIDIA GPU**——检测到就自动合并 `docker-compose.gpu.yml` 把 GPU 透传给容器，没检测到则自动用 CPU。**无需手动改任何配置**。注意需已安装 NVIDIA 驱动与 nvidia-container-toolkit 容器才能实际用上 GPU。首次启动自动拉取 NEXUS-Medical 模型（约 1GB），模型就绪前 AI 咨询走兜底。
- **数据库白名单**：若用 TiDB Cloud，需把部署机器出口 IP 加入集群白名单，否则连不上库。
- **健康档案长文本（M3）**：已彻底解决。schema 中 `health_records` 五字段与 `knowledge.tags` 均为 `@db.Text`；服务启动时入口脚本自动 `prisma db push` 把库结构对齐，超长病史/过敏写入不再 500。`nestjs/prisma/M3-text-migration.sql` 仍保留作离线手动兜底，但正常启动流程已不需要。
- 本部署为自用，未启用公网 HTTPS / 域名 / ICP，符合私有化语境。

## 常用命令
- 看日志：`docker compose logs -f api`
- 停止：`docker compose down`
- 重建 API：`docker compose up -d --build --no-deps api`
