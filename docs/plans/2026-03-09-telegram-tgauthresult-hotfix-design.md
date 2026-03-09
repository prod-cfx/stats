# Telegram `tgAuthResult` 生产热修设计（P0）

## 背景与问题
- 生产登录回调地址示例：
  - `https://www.coinflux.ai/zh/auth/telegram/callback?source=web&intent=login#tgAuthResult=...`
- 当前现象：前端提示“缺少 Telegram 授权参数，请先在 Telegram 中完成登录授权”。
- 已验证事实：`tgAuthResult` 可解码出完整字段（`id/auth_date/hash/first_name/username/photo_url`）。
- 根因：前端回调解析器仅支持 query 与普通 hash 键值，不支持 `#tgAuthResult=<base64|base64url-json>`。

## 目标
- 在生产环境快速恢复 Telegram 网页登录闭环。
- 不扩大改动面，不影响当前可用登录路径。

## 非目标
- 不调整后端接口与签名校验算法。
- 不重构 Telegram 桌面 intent/webhook 流程。
- 不引入新登录方式或页面结构变更。

## 方案对比

### 方案 A（采用）：前端最小热修
- 在 `resolveTelegramCallbackPayload` 中新增 `tgAuthResult` 解析。
- 兼容 `base64` 与 `base64url`。
- 参数优先级保持：`query > hash kv > tgAuthResult`。
- 解析失败时静默回退，不抛异常。

优点：
- 改动最小、上线最快、回滚简单。

风险：
- 无法覆盖后端签名类问题（若存在需另行排查）。

### 方案 B：前端热修 + 后端诊断增强
- 在 A 基础上增加后端日志分类与健康检查。

优点：
- 观测性更强。

风险：
- 改动面扩大，不利于当日 P0 恢复。

### 方案 C：配置全量整治 + 代码修复
- 同步处理 token/webhook/domain 与代码。

优点：
- 一次性治理更完整。

风险：
- 交付速度慢，不符合热修节奏。

## 详细设计

### 1) 解析策略
在 `apps/front/src/features/auth/telegram-callback-params.ts` 中新增：
- 从 hash 中读取 `tgAuthResult`。
- 执行 `base64/base64url` 解码并解析 JSON。
- 将 JSON 字段映射到现有 payload：
  - `id -> telegramId`
  - `auth_date -> authDate`
  - `hash -> hash`
  - `first_name/last_name/username/photo_url` -> 对应可选字段

### 2) 优先级与兼容
- `query` 已有值时绝不被覆盖。
- `hash` 键值（`#id=...&auth_date=...`）次优先。
- `tgAuthResult` 只在前两者缺失对应字段时补位。

### 3) 错误处理
- 解码失败、JSON 无效、字段缺失均不抛异常。
- 继续走既有逻辑，最终仍由页面统一提示错误。

## 测试设计
新增/更新 `apps/front/src/features/auth/telegram-callback-params.test.ts`：
1. 可解析 `#tgAuthResult=<base64-json>`。
2. 可解析 `#tgAuthResult=<base64url-json>`。
3. 非法 `tgAuthResult` 时安全回退。
4. 优先级验证：`query > hash kv > tgAuthResult`。

## 发布与回滚

### 发布步骤
1. 前端热修发布生产。
2. 用真实格式回调地址验证：
   - `.../auth/telegram/callback?source=web&intent=login#tgAuthResult=...`
3. 验收：不再出现“缺少 Telegram 授权参数”，可成功进入登录态。

### 回滚策略
- 若出现回归，直接回滚前端版本。
- 本次不涉及后端与数据迁移，回滚风险低。

## 风险与后续
- 若热修后仍失败，下一步优先检查：
  - BotFather `/setdomain` 是否为 `www.coinflux.ai`
  - 后端 `/auth/telegram/exchange` 签名校验失败原因
- 热修完成后建议补做方案 B（诊断增强）提升后续定位效率。
