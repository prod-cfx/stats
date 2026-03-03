# 巨鲸开单消息推送设计（方案 A）

日期：2026-03-03

## 1. 背景与目标

### 1.1 目标
新增面向用户的巨鲸开单推送能力，满足以下需求：
1. 用户可关注“自选巨鲸地址”，有开单时推送。
2. 用户可为关注规则设置金额阈值；支持“地址默认阈值 + 币种覆盖阈值”。
3. 用户可在规则级别选择通知渠道：网页（站内消息 + 浏览器系统通知）/ 邮箱 / TG。

### 1.2 已确认业务约束
1. 巨鲸定义：用户自选地址（非官方固定池）。
2. 地址来源：实时列表一键关注 + 手动输入补充。
3. 阈值模式：两层阈值（地址默认 + 币种覆盖）。
4. 网页通知：站内消息与浏览器系统通知都要。
5. 渠道粒度：规则级开关。
6. 频率控制：冷却去重（默认 60 秒）。
7. TG 目标：用户绑定的 Telegram 账号，由机器人推送。

## 2. 方案对比与结论

### 2.1 候选方案
1. 方案 A：事件驱动订阅引擎 + 多渠道分发（推荐）
2. 方案 B：在现有 `whale-alerts/realtime-stream` 内直接叠加规则与分发
3. 方案 C：仅做站内通知 MVP，邮箱/TG 二期

### 2.2 选择结论
选择方案 A。

理由：
1. 需求天然是“规则管理 + 实时匹配 + 多渠道分发”，需要解耦架构。
2. 更容易实现去重、重试、审计日志，且后续扩展事件源/渠道成本最低。
3. 避免把复杂逻辑耦合进现有 `whale-alerts` 接口，降低回归风险。

## 3. 架构设计

新增后端模块：`whale-notification`。

### 3.1 模块职责
1. Rule API（规则管理）
- 规则 CRUD、参数校验、渠道开关维护。

2. Matcher（规则匹配器）
- 消费巨鲸交易事件，按用户规则匹配命中。

3. Deduplicator（冷却去重）
- 基于去重键在冷却窗口内抑制重复推送。

4. Dispatcher（渠道分发）
- Web 站内消息、Web 浏览器通知（前端触发）、Email、Telegram。

5. Delivery Log（投递日志）
- 按渠道记录状态、错误、重试次数，支持排障与统计。

### 3.2 边界约束
1. 不改动现有 `whale-alert` 查询接口行为。
2. `whale-notification` 通过事件/增量触发，不进行全表轮询匹配。
3. 外部通道失败不影响其他渠道投递。

## 4. 数据模型（Prisma）

新增表（命名建议）：

### 4.1 `whale_notification_rules`
- `id`
- `user_id`
- `name`（可选）
- `is_enabled`
- `default_min_trade_value_usd`
- `channels`（json/位掩码，含 `web_inbox` `web_push` `email` `telegram`）
- `cooldown_seconds`（默认 60）
- `created_at` `updated_at`

### 4.2 `whale_notification_rule_addresses`
- `id`
- `rule_id`
- `whale_address`（标准化小写）
- `created_at`
- 唯一约束：`(rule_id, whale_address)`

### 4.3 `whale_notification_rule_symbol_overrides`
- `id`
- `rule_id`
- `whale_address`（可空；空表示规则级覆盖）
- `symbol`
- `min_trade_value_usd`
- `created_at` `updated_at`
- 唯一约束：`(rule_id, whale_address, symbol)`

### 4.4 `whale_notification_deliveries`
- `id`
- `user_id`
- `rule_id`
- `event_key`
- `whale_address` `symbol` `side` `trade_value_usd` `trade_time`
- `channel`（`web_inbox|web_push|email|telegram`）
- `status`（`pending|sent|failed|skipped_cooldown`）
- `error_message`（可选）
- `attempt_count`
- `sent_at` `created_at` `updated_at`
- 索引：`(user_id, created_at)`、`(status, created_at)`、`(event_key, channel)`

## 5. 端到端数据流

### 5.1 事件源
使用 `HyperliquidWhaleTrade` 的新增交易事件作为触发源。

### 5.2 匹配流程
1. 依据 `whale_address` 反查启用规则。
2. 计算生效阈值优先级：
- 地址+币种覆盖 > 规则级币种覆盖 > 规则默认阈值。
3. 校验交易金额是否达阈值。
4. 按规则渠道生成待投递任务。

### 5.3 去重规则
- 去重键：`user_id + whale_address + symbol + side + channel`
- 时间窗：`cooldown_seconds`（默认 60）
- 命中时写入 `skipped_cooldown`。

### 5.4 渠道分发
1. `web_inbox`：写站内通知记录。
2. `web_push`：前端在拉取到新站内消息后触发浏览器通知。
3. `email`：复用 `MailService`。
4. `telegram`：复用 Bot 发送能力，目标为绑定 TG 账号。

### 5.5 失败与重试
- 记录失败原因与 `attempt_count`。
- 限次重试（建议最多 3 次，指数退避）。

## 6. API 设计

新增受保护控制器：`/whale-notification-rules`

1. `GET /whale-notification-rules`
- 查询当前用户规则列表（含地址、覆盖、渠道、启停状态）。

2. `POST /whale-notification-rules`
- 创建规则。

3. `PATCH /whale-notification-rules/:id`
- 更新规则。

4. `POST /whale-notification-rules/:id/toggle`
- 启停规则。

5. `DELETE /whale-notification-rules/:id`
- 删除规则。

6. `GET /whale-notifications`
- 查询站内通知（分页）。

7. `POST /whale-notifications/read`
- 批量标记已读（可作为次阶段）。

## 7. 前端设计

1. 实时巨鲸页（`/whale-tracking/realtime`）
- 每行新增“关注”入口。
- 首次关注引导创建默认规则。

2. 通知规则页（新增）
- 管理地址列表。
- 配置默认阈值与币种覆盖。
- 规则级渠道开关（站内/浏览器/邮箱/TG）。

3. 通知中心（新增）
- 展示站内通知列表，支持跳转地址详情/相关币种页面。

4. 浏览器通知授权
- 在规则页触发 `Notification.requestPermission()`。
- 拒绝授权时仍保留站内消息。

## 8. 错误处理

1. 参数非法（地址、阈值、空渠道）
- 返回 `DomainException + ErrorCode`。

2. 渠道不可投递
- 未绑定或不可用时记录失败原因，不阻断其他渠道。

3. 外部依赖失败（Resend/TG API）
- 渠道级失败 + 重试，不影响其他渠道。

## 9. 测试策略

### 9.1 后端单测
1. 阈值优先级计算。
2. 去重键与冷却窗口判定。
3. 渠道可用性判定。

### 9.2 后端 E2E
1. 创建规则 -> 注入事件 -> 命中通知。
2. 冷却窗口内重复事件 -> `skipped_cooldown`。
3. 多渠道部分失败不影响整体。

### 9.3 前端测试
1. 规则页表单校验。
2. 实时列表一键关注行为。
3. 通知中心渲染与授权提示。

## 10. 发布与观测

1. 灰度发布：先对内部账号开放。
2. 全量发布：默认先启用站内，邮箱/TG 由用户主动开启。
3. 指标：投递成功率、失败率、去重命中率、规则命中率。

## 11. 非目标（本期不做）

1. 复杂订阅表达式（如多条件逻辑组合）。
2. 用户自定义 webhook 渠道。
3. 推送模板可视化编辑器。
4. 跨产品多事件统一通知中心（留作后续演进）。
