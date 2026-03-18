# 市场数据模块

## 概述

本模块负责采集行情数据、写入存储，并通过 `GET /market/stream/ticker` 向内部调用方提供 SSE 实时推送。

## 使用方式

1. 在仓库根目录执行 `dx db generate quantify --dev`
2. 启动服务：`dx start quantify --dev`
3. 在内部调用方连接 `http://localhost:3010/api/v1/market/stream/ticker`
4. 日常本地审查先执行 `bash scripts/acceptance/quantify-market-data-preflight.sh`
5. 第一层真实链路检查使用：
   - `bash scripts/acceptance/quantify-market-data-runtime.sh start`
   - `bash scripts/acceptance/quantify-market-data-gate1-check.sh BTCUSDT`
   - `bash scripts/acceptance/quantify-market-data-runtime.sh stop`

## Symbol 回填

在引入 `:SPOT/:PERP` 编码后，可执行一次历史回填：

1. 先 dry-run：
   - `pnpm --filter @net/quantify exec tsx scripts/backfill-market-symbol-codes.ts --dry-run`
2. 再 apply：
   - `pnpm --filter @net/quantify exec tsx scripts/backfill-market-symbol-codes.ts --apply`

说明：

- 脚本只处理无后缀 code，例如 `BTCUSDT -> BTCUSDT:SPOT`。
- 已有后缀（如 `:PERP`）不会被改写。
- 重复执行是幂等的，第二次不会继续更新。
- 回滚按 dry-run / apply 输出清单逐条恢复 `code` 字段即可。

## 文档索引

- [QUICKSTART.md](./QUICKSTART.md)：快速接入说明
- [SSE_IMPLEMENTATION.md](./SSE_IMPLEMENTATION.md)：SSE 实现与数据流
- [SUMMARY.md](./SUMMARY.md)：模块能力摘要

## 特性

- 行情采集与持久化
- SSE 实时推送
- 面向内部调用方的统一接入方式
- 支持多订阅方并发消费
- 策略与 AI 读取市场数据统一通过 `MarketDataReadGateway`
- 本地审查采用双层门禁：第一层真实链路正确性，第二层 mock 消费方 smoke

## 本地审查

### 第一层：0~45 分钟最小审查

1. `bash scripts/acceptance/quantify-market-data-preflight.sh`
2. `dx test unit quantify`
3. `dx test e2e quantify apps/quantify/e2e/market-data`
4. `bash scripts/acceptance/quantify-market-data-runtime.sh start`
5. `bash scripts/acceptance/quantify-market-data-gate1-check.sh BTCUSDT`
6. `bash scripts/acceptance/quantify-market-data-runtime.sh stop`

说明：

- `market-data` provider 必须走真实 Binance REST / WS
- `apps/quantify/e2e/market-data/market-data.e2e-spec.ts` 仍使用 provider override，只用于自动化回归，不可替代真实链路审查

### 第二层：完整验收扩展

1. 完整通过第一层 Gate
2. 持续观察 `30~120` 分钟
3. 执行一次 `runtime stop/start` 恢复检查
4. 跑 mock 消费方 smoke

边界：

- `market-data` 本体必须是真实 Binance 链路
- `strategy` / `ai` / `trading` 只在第二层通过 mock smoke 验证消费契约

## 故障排查

- 连接失败：确认 quantify 服务已经启动，且调用方可访问 `/api/v1/market/stream/ticker`
- 没有数据：检查 Binance WebSocket 连接状态与 market-data 模块日志
- 频繁断线：检查内部网络、代理超时与调用方重连逻辑
