# 巨鲸通知上线与灰度运行手册

## 1. 功能开关与配置项

后端使用以下环境变量控制巨鲸通知：

- `WHALE_NOTIFICATION_ENABLED`
  - `true`：启用通知编排。
  - `false`：全量关闭（交易事件不再产生日志投递）。
- `WHALE_NOTIFICATION_ALLOWED_USER_IDS`
  - 灰度白名单，逗号分隔用户 ID。
  - 为空时表示全量放开。
- `WHALE_NOTIFICATION_COOLDOWN_SECONDS`
  - 去重冷却窗口，默认 `60`。
- `WHALE_NOTIFICATION_RETRY_MAX_ATTEMPTS`
  - 渠道分发最大重试次数，默认 `3`。
- `WHALE_NOTIFICATION_RETRY_BACKOFF_MS`
  - 重试间隔毫秒，默认 `500`。

## 2. 建议灰度节奏

1. 首发阶段（内部验证）
  - `WHALE_NOTIFICATION_ENABLED=true`
  - `WHALE_NOTIFICATION_ALLOWED_USER_IDS=<内部账号列表>`
2. 小流量阶段（5%-20%）
  - 白名单扩容，覆盖目标用户样本。
3. 全量阶段
  - `WHALE_NOTIFICATION_ALLOWED_USER_IDS=`（留空）
4. 紧急回滚
  - 直接设置 `WHALE_NOTIFICATION_ENABLED=false` 并重启后端实例。

## 3. 监控接口与关键指标

接口：`GET /api/v1/whale-notification/metrics`

关键字段：

- `eventsReceived`：收到的交易事件数
- `matchedRules`：命中规则数
- `grayReleaseSkippedMatches`：被灰度白名单过滤的命中数
- `deliveryCandidates`：待投递候选数
- `deliveriesSent`：发送成功数
- `deliveriesFailed`：发送失败数
- `deliveriesSkippedCooldown`：冷却期跳过数
- `featureFlagSkippedEvents`：因总开关关闭而跳过的事件数
- `dispatchRetryAttempts`：触发重试的次数

## 4. 告警建议

建议按 5 分钟窗口做告警：

- 失败率告警：
  - 条件：`deliveriesFailed / (deliveriesSent + deliveriesFailed) > 20%`
  - 持续：连续 3 个窗口
- 重试激增告警：
  - 条件：`dispatchRetryAttempts` 较前 1 小时均值升高 3 倍
- 总开关误关告警：
  - 条件：`featureFlagSkippedEvents > 0` 且非维护窗口

## 5. 排障速查

1. 先查配置：
  - `WHALE_NOTIFICATION_ENABLED`
  - `WHALE_NOTIFICATION_ALLOWED_USER_IDS`
2. 查链路：
  - `eventsReceived` 是否增长
  - `matchedRules` 是否增长
  - `deliveryCandidates` 是否增长
3. 渠道问题：
  - `deliveriesFailed`、`dispatchRetryAttempts` 是否异常升高
4. Telegram 专项：
  - 用户是否已绑定 Telegram（`user_credentials.value` 是否有 `telegram:<id>`）
  - `TELEGRAM_BOT_TOKEN` 是否配置
