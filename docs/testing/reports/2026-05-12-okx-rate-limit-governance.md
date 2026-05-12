# OKX rate-limit governance acceptance draft

日期：2026-05-12
Issue：#1233, #1234, #1235
范围：OKX 公测速率治理验收映射、已具备的代码/测试证据、待生产环境动作。本文是验收草案，不代表 issue 已关闭。

## Status

- 当前状态：Local implementation and focused acceptance evidence completed for the code paths listed below.
- 已完成方向：feature flags/config、OKX 429/50011 retry/metrics、shared instrument/public data 基础、token bucket 基础、OKX private WS 基础、executor WS event consumer、egress dispatcher、shard health metadata 和 workload sharding 本地测试证据。
- 未完成方向：完整灰度三阶段、生产 flag-off 部署验证、生产 shard-1 空跑证据、生产环境 `/metrics`/日志通道读取证据。

## #1234 Acceptance Mapping

| 验收项 | 当前代码/测试证据 | 状态 |
| --- | --- | --- |
| A 退避：HTTP 429 / body `50011` 重试，flag off 回旧行为 | `apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts` 覆盖 HTTP 429 backoff、50011 JSON retry、rate-limit metrics；`apps/quantify/src/config/configuration.ts` 暴露 `QUANTIFY_OKX_RETRY_ENABLED`。 | Done locally; e2e flag-off evidence pending |
| B cron 错峰 | `apps/quantify/src/config/configuration.ts` 暴露 `QUANTIFY_SIGNAL_GEN_SPREAD_ENABLED`。当前未看到错峰分布测试证据。 | Pending |
| C `instrumentSpec` 单例缓存 | `apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts` / plan 中指向 repeated OKX clients reuse `/api/v5/public/instruments`；`QUANTIFY_INSTRUMENT_CACHE_SHARED` 已有 config flag。 | Done locally if corresponding spec passes; command evidence pending |
| D per-API-key token bucket | `apps/quantify/src/modules/trading/services/rate-limiter-registry.service.ts` 和 spec 覆盖 acquire 排队、queue depth metrics；`ExchangeFactory`/`OkxClient` 具备注入点；`QUANTIFY_TOKEN_BUCKET_ENABLED` 已有 flag。 | Done locally for foundation; private/public bucket policy e2e pending |
| F private WS order/account/positions | `apps/quantify/src/modules/trading/exchanges/okx-private-ws-client.spec.ts` 覆盖 flag off 不连接、启动加载 OKX accounts、login payload、subscribe `orders/account/positions`、订单/仓位事件 emit、断线指标日志；`apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts` 覆盖 WS filled event 落库、找不到不抛、非终态只 ack；`apps/quantify/e2e/strategy-signals/okx-private-ws-execution.e2e-spec.ts` 在真实 Postgres JSONB 上覆盖 order id / nested client order id path 匹配与已终态排除。 | Done locally; live OKX/staging socket evidence pending |
| F 公共数据共享 | `apps/quantify/src/modules/trading/trading.service.spec.ts` 覆盖 OKX ticker 走 shared market data quote；`QUANTIFY_PUBLIC_DATA_SHARED` 已有 flag。 | Done locally for ticker path; full strategy tick direct-call audit pending |
| Prisma pool | `apps/quantify/src/config/configuration-okx-rate-limit.spec.ts` 覆盖 `prismaPool` env/default；生产/压力 case 证据未采集。 | Partial |
| 监控 | `apps/quantify/src/modules/message-bus/metrics/message-bus-metrics.service.spec.ts` 覆盖 OKX 429/50011 totals 和 token bucket queue depth；`OkxClient` spec 覆盖指标调用。 | Partial; `/metrics` or log-channel production evidence pending |
| Flag | `apps/quantify/src/config/configuration-okx-rate-limit.spec.ts` 覆盖 flag 默认 false；各能力的逐项 e2e off 行为尚未完整采集。 | Partial |
| 灰度 | #1234 不要求完成灰度本身，但要求生产 flag off 部署一次并文档化流程。 | Pending production |

## #1235 Acceptance Mapping

| 验收项 | 当前代码/测试证据 | 状态 |
| --- | --- | --- |
| 分片路由单测 | `apps/quantify/src/modules/sharding/services/workload-sharding.service.spec.ts`。 | Done locally |
| 接入点行为验证 | `apps/quantify/src/modules/strategy-signals/services/__tests__/signal-generator.service.spec.ts` 覆盖 sharding enabled/disabled；`apps/quantify/e2e/health/health.e2e-spec.ts` 覆盖 `/health` shard metadata 默认值与配置值。 | Done locally; production shard-1 dry-run pending |
| egress 抽象单测 | `apps/quantify/src/modules/trading/exchanges/base-cex-client.spec.ts` 和 `apps/quantify/src/modules/trading/factory/exchange-factory.spec.ts`。 | Done locally |
| 回归兼容 | config defaults keep sharding disabled and `SHARD_COUNT=1 SHARD_INDEX=0`。 | Done locally; full unit/e2e regression pending |
| 生产空跑 | 见 `docs/testing/reports/2026-05-12-okx-shard-dryrun.md`。 | Pending production |
| 回滚验证 | 见 dry-run 报告证据模板。 | Pending production |

## Test Commands To Attach

这些是验收评论/PR body 里应贴的最小复现命令。本轮已执行覆盖这些路径的 focused unit loop，并完成 `dx build quantify --dev` 与 `dx lint`。

| Command | Covers |
| --- | --- |
| `dx test unit quantify apps/quantify/src/config/configuration-okx-rate-limit.spec.ts` | #1234/#1235 flags、sharding、http egress、prisma pool config |
| `dx test unit quantify apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts -t "retries OKX"` | #1234 A 退避与 429/50011 识别 |
| `dx test unit quantify apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts -t "records OKX rate-limit metrics"` | #1234 监控指标写入 |
| `dx test unit quantify apps/quantify/src/modules/trading/services/rate-limiter-registry.service.spec.ts` | #1234 D token bucket 基础与 queue depth metrics |
| `dx test unit quantify apps/quantify/src/modules/message-bus/metrics/message-bus-metrics.service.spec.ts` | #1234 OKX metrics snapshot |
| `dx test unit quantify apps/quantify/src/modules/trading/exchanges/okx-private-ws-client.spec.ts` | #1234 F private WS login/subscribe/event normalization/flag-off |
| `dx test unit quantify apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts -t "OKX private"` | #1234 F private WS order event to execution record |
| `dx test e2e quantify apps/quantify/e2e/strategy-signals/okx-private-ws-execution.e2e-spec.ts` | #1234 F private WS execution matching against real Postgres JSONB paths |
| `dx test unit quantify apps/quantify/src/modules/trading/trading.service.spec.ts -t "shared market data"` | #1234 F 公共数据共享 ticker path |
| `dx test unit quantify apps/quantify/src/modules/trading/exchanges/base-cex-client.spec.ts` | #1235 egress dispatcher |
| `dx test unit quantify apps/quantify/src/modules/trading/factory/exchange-factory.spec.ts` | #1234/#1235 client factory config injection |
| `dx test unit quantify apps/quantify/src/modules/sharding/services/workload-sharding.service.spec.ts` | #1235 shard routing |
| `dx test unit quantify apps/quantify/src/modules/strategy-signals/services/__tests__/signal-generator.service.spec.ts -t "sharding"` | #1235 signal-generator workload sharding |
| `dx test unit quantify apps/quantify/src/modules/health/health.service.spec.ts` | #1235 `/health` shard metadata |
| `dx test e2e quantify apps/quantify/e2e/health/health.e2e-spec.ts` | #1235 `/health` shard metadata API response |

## Production / Environment Actions Still Required

- #1234：逐个 flag-off e2e 证据，至少覆盖 retry、spread、shared instrument cache、token bucket、public data shared、private WS。
- #1234：生产以 flag off 状态部署一次，并记录切换/回滚流程。
- #1234：cron 错峰分布测试或等价证据仍需补齐。
- #1234：private WS order/account/positions 本地 foundation 与真实 Postgres JSONB matching e2e 已完成；仍需 live OKX/staging socket 连接与日志/指标证据。
- #1234：Prisma pool 并发 50 事务压力 case 和 `/metrics`/日志通道读取证据仍需采集。
- #1235：生产 `shard-1` 空跑 1h 和停机回滚验证仍需执行并回填 dry-run 报告。
- #1235：如果 reviewer 严格要求 e2e 而非 unit/spec 证据，需要补 `dx test e2e quantify ...` 的 shard filtering case。

## Epic #1233 Comment Draft

```markdown
## OKX rate-limit governance progress update - 2026-05-12

本次已完成 #1234/#1235 可本地闭环的核心实现与验证，但不关闭子 issue；真实生产/灰度/空跑证据仍需要在目标环境执行。主 Epic 可以先按下面状态看整体进度。

### #1234 公测限流治理

- A 退避/429/50011：本地已有 `OkxClient` unit 证据，覆盖 HTTP 429、body `50011` retry/backoff 和 rate-limit metrics。待补：flag off 的 e2e 证据。
- B cron 错峰：config flag 已存在；错峰分布验收证据仍 pending。
- C shared instrument cache：已有 shared cache 方向和 spec 入口；待贴命令输出确认 repeated OKX clients 下 `/api/v5/public/instruments` 调用次数。
- D token bucket：`RateLimiterRegistry`、OKX client 注入和 queue depth metrics 已有本地单测证据。待补：私有/公共桶策略的 e2e 或压力证据。
- F private WS：本地已有 private WS client + executor event consumer 证据，覆盖 login/subscribe、orders/positions event emit、filled order event 落 execution。待补：真实 DB/e2e integration 证据。
- F 公共数据共享：OKX ticker 走 shared market data 的本地 spec 已有；strategy tick 全路径 direct-call audit 仍待补。
- 监控/Prisma/Flag/灰度：OKX 429/50011 totals、token bucket queue depth、config defaults 已有本地证据；生产 flag-off 部署、`/metrics` 或日志通道读取、Prisma pool 压测和三阶段灰度仍是环境动作。

建议 #1234 暂不关闭：private WS 真实 DB/e2e、错峰验收、完整 flag-off e2e、生产 flag-off 部署仍未完成。

### #1235 扩容钩子与 shard dry-run

- 分片路由：`WorkloadShardingService` 单测已覆盖默认单 shard、稳定性和分布。
- 接入点：signal-generator 已有 sharding enabled/disabled 的本地 spec 证据；需要注意实现证据显示 generation 侧按 `strategyInstance.id` 做 workload sharding，而不是 issue 原文的 `user_id`，验收时应确认这是有意调整。
- egress：`BaseCexClient` dispatcher 注入、proxy/localAddress dispatcher 创建、ExchangeFactory 配置传递已有单测证据。
- `/health`：shard metadata 本地 spec 已有。
- 生产空跑：文档模板已补到 `docs/testing/reports/2026-05-12-okx-shard-dryrun.md`，但实际 shard-1 生产空跑 1h、0 strategy load、无 error 日志和停机回滚验证仍 pending。

建议 #1235 暂不关闭：生产 dry-run 和回滚证据未采集；如 reviewer 坚持 e2e 口径，还需要补 shard filtering e2e。

### Epic #1233 当前可勾/不可勾判断

- `Issue 1 关闭`：不可勾，#1234 仍有 private WS 真实 DB/e2e、错峰/flag-off/生产灰度前置证据缺口。
- `Issue 2 关闭`：不可勾，#1235 仍缺生产 shard-1 dry-run 和回滚证据。
- `公测灰度三阶段`：不可勾，环境动作未开始。
- `生产 shard-1 空跑 1h`：不可勾，模板已准备，证据待采集。
- `任一新增能力 feature flag off 等同旧路径`：不可勾，已有 config 默认值证据，但逐项 e2e flag-off 证据未完整。

下一步建议只让 worker 回填两类材料：

1. #1234 worker：贴最小 unit/e2e 命令输出，补错峰、flag-off、metrics/Prisma 证据；private WS 继续补真实 DB/e2e 证据。
2. #1235/ops worker：按 dry-run 模板执行生产 shard-1 空跑，回填启动日志、`/health`、1h error log query、active strategy count、资源摘要和回滚时间戳。
```
