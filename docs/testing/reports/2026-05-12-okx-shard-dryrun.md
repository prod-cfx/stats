# OKX shard dry-run acceptance report

日期：2026-05-12
Issue：#1233, #1235
范围：生产 `shard-1` 空跑验收模板、已具备的本地代码/测试证据、剩余生产环境动作。

## Status

- 当前状态：Pending production dry-run。
- 本地材料：已补齐生产空跑步骤、观测口径、回滚口径和证据模板。
- 生产动作：尚未执行；需要部署侧按本文采集 1h 运行证据后回填。

## Acceptance Mapping

| Issue | 验收项 | 当前证据 | 状态 |
| --- | --- | --- | --- |
| #1235 | 分片路由单测 | `apps/quantify/src/modules/sharding/services/workload-sharding.service.spec.ts` 覆盖默认单 shard、分布、稳定性、关闭开关行为。 | Done locally |
| #1235 | 接入点 e2e / 行为验证 | `apps/quantify/src/modules/strategy-signals/services/__tests__/signal-generator.service.spec.ts` 覆盖 sharding enabled 时按 strategy instance id 过滤，disabled 时保留全部实例。 | Done locally; e2e scope pending if reviewer insists on e2e-only evidence |
| #1235 | egress 抽象单测 | `apps/quantify/src/modules/trading/exchanges/base-cex-client.spec.ts` 覆盖 dispatcher 注入、空配置省略 dispatcher、proxy/localAddress dispatcher 创建；`apps/quantify/src/modules/trading/factory/exchange-factory.spec.ts` 覆盖配置传递。 | Done locally |
| #1235 | 回归兼容 | `apps/quantify/src/config/configuration-okx-rate-limit.spec.ts` 覆盖默认 `QUANTIFY_SHARDING_ENABLED=false`、`SHARD_COUNT=1`、`SHARD_INDEX=0`。 | Done locally |
| #1235 | 生产空跑 | 需要生产部署 `SHARD_COUNT=2 SHARD_INDEX=1` 的第二 quantify 实例，不接入流量，观察 1h。 | Pending production |
| #1235 | 回滚验证 | 空跑结束后停止 shard-1，并确认主 quantify 继续以 `SHARD_COUNT=1 SHARD_INDEX=0` 服务全部用户。 | Pending production |
| #1233 | 在生产部署一次 shard-1 空跑 | 本文为 Epic 验收提供证据模板；实际截图/日志摘要待回填。 | Pending production |

## Production Dry-run Procedure

1. 使用与主 quantify 相同的镜像部署第二个 quantify 实例。
2. 不接入 API gateway、负载均衡或用户流量入口。
3. 设置环境变量：

   ```text
   QUANTIFY_SHARDING_ENABLED=true
   SHARD_COUNT=2
   SHARD_INDEX=1
   QUANTIFY_EGRESS_PROXY_URL=
   QUANTIFY_EGRESS_LOCAL_ADDRESS=
   ```

4. 启动实例，确认启动日志包含 shard count/index，例如 `[Sharding] count=2 index=1` 或等价结构化字段。
5. 请求 `/health`，确认响应包含：

   ```json
   {
     "shard": {
       "enabled": true,
       "count": 2,
       "index": 1,
       "activeStrategies": 0
     }
   }
   ```

6. 连续观察 1h，并记录：
   - error 级日志数量为 0；
   - active strategy count 保持 0；
   - CPU / memory 无持续上升；
   - Prisma、Bull、message bus 连接保持健康；
   - 未出现 signal-generator / signal-executor 抢占主实例用户的迹象。
7. 停止 shard-1 空跑实例。
8. 确认主 quantify 实例继续以 `SHARD_COUNT=1 SHARD_INDEX=0` 服务全部用户，用户侧无感知。

## Evidence Template

| 字段 | 记录 |
| --- | --- |
| 执行人 | TBD |
| 环境 | production |
| 镜像 tag / commit | TBD |
| shard-1 start time | TBD |
| shard-1 stop time | TBD |
| env snapshot | `QUANTIFY_SHARDING_ENABLED=true`, `SHARD_COUNT=2`, `SHARD_INDEX=1`, egress env blank or value masked |
| 启动日志摘要 | TBD；必须包含 shard count/index |
| `/health` 响应摘要 | TBD；必须包含 `shard.enabled=true`, `count=2`, `index=1`, `activeStrategies=0` |
| 1h error log query | TBD；期望 0 |
| active strategy count | TBD；期望 0 |
| CPU / memory summary | TBD；期望平稳 |
| Prisma / Bull / message bus health | TBD |
| rollback timestamp | TBD |
| primary quantify health after rollback | TBD；期望健康 |
| 用户影响 | TBD；期望无用户感知 |

## Local Verification Commands

这些命令用于证明 #1235 的本地代码路径；本报告未重新执行命令，只记录验收时应贴的最小命令集。

| Command | Purpose |
| --- | --- |
| `dx test unit quantify apps/quantify/src/modules/sharding/services/workload-sharding.service.spec.ts` | 分片路由默认值、稳定性、分布和关闭开关行为 |
| `dx test unit quantify apps/quantify/src/modules/strategy-signals/services/__tests__/signal-generator.service.spec.ts -t "sharding"` | signal-generator 分片过滤接入点 |
| `dx test unit quantify apps/quantify/src/modules/trading/exchanges/base-cex-client.spec.ts` | egress dispatcher 注入与空配置兼容 |
| `dx test unit quantify apps/quantify/src/modules/trading/factory/exchange-factory.spec.ts` | ExchangeFactory 传递 egress/token bucket/retry 配置 |
| `dx test unit quantify apps/quantify/src/config/configuration-okx-rate-limit.spec.ts` | flag/sharding/httpEgress/prismaPool 默认值与 env 解析 |
| `dx test unit quantify apps/quantify/src/modules/health/health.service.spec.ts` | `/health` shard metadata |

## Remaining Concerns

- 生产空跑证据尚未采集，因此 #1233/#1235 中 “shard-1 空跑 1h” 与 “回滚验证” 不能勾选。
- #1235 issue 文案要求按 `user_id` 过滤；当前本地证据显示 signal generation 侧按 `strategyInstance.id` 做 workload sharding。这是实现层对路由键的调整，Epic comment 需要明确说明，避免验收时误判。
- 生产空跑必须确认 shard-1 未接入任何用户入口；否则 `SHARD_COUNT=2 SHARD_INDEX=1` 可能接管一部分 workload，不再是空跑。
