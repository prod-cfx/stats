# Telegram 登录恢复设计（生产优先）

## 背景
- 现象 1：Telegram 桌面登录点击后，机器人聊天窗口只看到用户 `/start`，没有机器人返回“授权成功继续链接”。
- 现象 2：Telegram 网页登录回调进入 `https://www.coinflux.ai/zh/auth/telegram/callback?...#tgAuthResult=...`，前端报“缺少 Telegram 授权参数”。
- 已证据：调用 Telegram OpenAPI `getMe` 返回 `{"ok":false,"error_code":404,"description":"Not Found"}`，说明生产 `TELEGRAM_BOT_TOKEN` 当前无效。

## 目标
在生产环境恢复 Telegram 登录闭环（网页 + 桌面），并补齐可观测性，保证后续可快速定位配置类问题。

## 范围
### In Scope
- 生产配置修复清单（Bot token / webhook / BotFather domain）
- 前端兼容 `#tgAuthResult=<base64-json>` 回调格式
- 后端增加 Telegram 登录可观测日志与健康检查接口
- 验收与回滚流程文档化

### Out of Scope
- 重构现有认证主流程
- 新增新的登录方式
- 批量修改非 Telegram 相关页面

## 根因判断
1. **配置根因（P0）**
- 生产 `TELEGRAM_BOT_TOKEN` 无效（`getMe` 返回 404）。
- 影响：
  - 桌面链路 webhook 无法正确完成机器人回链；
  - 网页链路后端签名校验无法通过。

2. **前端兼容缺口（P1）**
- Telegram 网页回调在当前真实路径中使用 `#tgAuthResult`，现有参数解析仅覆盖 `query` 和 `#key=value&...`，未覆盖 `#tgAuthResult`。
- 影响：前端直接误判参数缺失。

3. **可观测性不足（P1）**
- 缺少可快速判断“token 无效 / webhook 未触发 / 解析失败 / 签名失败”的标准化指标和日志。

## 方案对比
### 方案 A（推荐）：配置 + 代码双轨修复
- 配置层先修生产 Bot token、webhook、BotFather domain。
- 代码层补 `tgAuthResult` 解析、后端健康检查与结构化日志。
- 优点：根因与复发风险一起解决。
- 成本：一次配置变更 + 一次代码发布。

### 方案 B：仅配置修复
- 只改生产配置，不发版。
- 风险：`tgAuthResult` 兼容问题仍在，用户仍可能报“缺少参数”。

### 方案 C：仅代码修复
- 不修生产 token，仅改代码。
- 风险：token 仍无效，桌面与签名流程仍失败。

## 详细设计
### 1) 生产配置修复清单（必须）
1. 在生产 Secret 管理中更新：
- `TELEGRAM_BOT_TOKEN=<有效 token>`
- `TELEGRAM_LOGIN_BOT_NAME=<bot username，不带@也可>`
- `TELEGRAM_BOT_WEBHOOK_SECRET=<随机高强度字符串>`

2. 通过 Telegram API 重设 webhook：
- `setWebhook` URL 指向：`https://<backend-domain>/api/v1/auth/telegram/bot/webhook`
- 带上 `secret_token` 与后端一致

3. BotFather 执行 `/setdomain`：
- 设置为：`www.coinflux.ai`

4. 快速验证：
- `getMe` 必须 `ok: true`
- `getWebhookInfo.url` 与目标一致
- `getWebhookInfo.last_error_message` 为空或非近期错误

### 2) 前端回调兼容
- 在 `resolveTelegramCallbackPayload` 中增加分支：
  - 若 hash 存在 `tgAuthResult`，尝试 base64/base64url 解码 JSON；
  - 从 JSON 提取 `id/auth_date/hash/first_name/last_name/username/photo_url` 并映射到当前 payload。
- 优先级：`query > hash kv > tgAuthResult`（避免已显式 query 被覆盖）。
- 解析失败时不抛出异常，保留原有缺参错误提示。

### 3) 后端可观测性与健康检查
- 新增 Telegram health check 接口（仅管理员或内部鉴权可访问）：
  - 输出 `botConfigured`、`botNameResolved`、`webhookConfigured`、`webhookUrlMatch`、`lastWebhookError`。
- 在关键流程增加结构化日志（不打印敏感 token）：
  - `createTelegramDesktopIntent`
  - `handleTelegramBotWebhook`
  - `telegramExchange`
  - 失败分类：`TOKEN_INVALID`、`WEBHOOK_NOT_TRIGGERED`、`PAYLOAD_PARSE_FAILED`、`SIGNATURE_INVALID`。

## 生产验收标准
1. **配置验收**
- `getMe.ok === true`
- `getWebhookInfo.url` 精确匹配生产 webhook
- BotFather `/setdomain` 已配置 `www.coinflux.ai`

2. **功能验收**
- 网页登录：`#tgAuthResult=...` 回调可成功登录，无“缺少参数”
- 桌面登录：机器人收到 `/start` 后返回继续登录链接，回调可成功完成登录

3. **可观测性验收**
- 后端日志可区分 4 类失败原因并定位到模块
- 健康检查接口可在 1 次调用内判断当前配置状态

## 风险与缓解
- 风险：生产 token 更新后忘记同步 webhook secret。
  - 缓解：配置变更 checklist 绑定验收脚本，缺一不可。
- 风险：前端解码 `tgAuthResult` 兼容性不足。
  - 缓解：加入 base64 与 base64url 双路径测试。
- 风险：健康检查泄露敏感信息。
  - 缓解：接口输出布尔状态与摘要，不返回 token 原文。

## 回滚策略
1. 临时回滚策略：前端关闭 Telegram 登录入口，仅保留邮箱登录。
2. 配置回滚：恢复上一个可用 token + webhook 组合。
3. 代码回滚：回退本次 Telegram 相关 commit。

## 里程碑
1. M1：生产配置修复完成并通过 API 验证。
2. M2：前端 `tgAuthResult` 兼容发布并通过回归测试。
3. M3：后端健康检查与日志发布并接入验收。
4. M4：生产全链路验收通过，关闭事件。
