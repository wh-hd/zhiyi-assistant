# 安全运维说明

## 管理员白名单

1. 管理员候选账号先完成登录，携带 Access Token 调用 `GET /v1/users/me`。
2. 从统一响应的 `data.id` 读取内部用户 ID。不要使用微信 openid。
3. 配置 `ADMIN_USER_IDS`。多管理员以英文逗号分隔，例如 `user-id-a,user-id-b`；程序会忽略条目前后空格与空条目。
4. 未配置、空字符串或仅空白时，系统采用 deny-by-default：所有用户均不能修改全局阈值，但查询接口仍可用。
5. 修改环境变量后，重启直接运行的 NestJS 实例，或滚动重建全部 API 容器，确保每个实例读取一致配置。
6. 启动日志只会显示白名单是否启用和数量，不会显示 ID。

## 微信登录

生产环境必须同时配置 `WX_APP_ID` 与 `WX_APP_SECRET`。`WX_JSCODE2SESSION_TIMEOUT_MS` 默认为 8000，允许 1000 至 30000 毫秒。部分配置、占位配置、超时、网络错误或非法上游响应都会关闭登录，不会退化为开发身份。开发身份仅允许在 `NODE_ENV=development` 且两项凭证均缺失或均为明确占位值时使用。

## Refresh Token 重放告警

- 开发和测试可使用 `SECURITY_ALERT_CHANNEL=log`。
- 生产发布前必须配置 `SECURITY_ALERT_CHANNEL=webhook` 及 `SECURITY_ALERT_WEBHOOK_URL`；应用会在生产配置缺失或非法时 fail-fast，发布流水线也应提前校验。
- Webhook 接收通用 JSON，事件只包含事件类型、环境、脱敏用户标识、UTC 时间和清洗后的 requestId。
- `SECURITY_ALERT_TIMEOUT_MS` 默认 3000；发送失败不会影响撤销或鉴权结果。
- 相同实例内，同一事件和脱敏用户默认五分钟限频，首次立即发送。多实例可能各发送一次，建议在告警平台继续聚合。
- 上线前应执行一次重放演练，确认值班渠道五分钟内可见，并观察应用日志中 `安全告警发送失败`。

## 过期 Token 清理

调度任务每天 03:30（`Asia/Shanghai`）运行，仅删除 `expiresAt < cutoff` 的记录。未过期但已撤销的记录会保留以支持重放检测。`REFRESH_TOKEN_CLEANUP_BATCH_SIZE` 默认 500，允许 50 至 5000。

观察日志中的清理开始/完成、删除数、批次数和耗时；任务失败会记录异常类型且不影响鉴权，下一周期自动重试。多实例重复执行是安全且幂等的。上线迁移前需确认 TiDB 在线 DDL 窗口和 `expiresAt` 索引执行计划。

## 凭证处置

版本库部署文件如曾包含真实形态凭证，应立即在对应平台轮换并移出版本控制。本文和示例不记录旧值；生产凭证应由部署系统或密钥管理服务注入。
