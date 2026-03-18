# 市场数据 SSE 快速开始

## 前提

所有命令都从仓库根目录执行。

## Symbol 规范

- 现货：`<RAW_SYMBOL>:SPOT`，例如 `BTCUSDT:SPOT`
- 合约：`<RAW_SYMBOL>:PERP`，例如 `BTCUSDT:PERP`
- 兼容期无后缀 symbol 会优先映射到 `:SPOT`
- 生产切换建议顺序：先执行回填脚本，再重启服务，再观察指标

## 启动服务

```bash
dx start quantify --dev
```

## 第一层最小审查

```bash
bash scripts/acceptance/quantify-market-data-preflight.sh
dx test unit quantify
dx test e2e quantify apps/quantify/e2e/market-data
bash scripts/acceptance/quantify-market-data-runtime.sh start
bash scripts/acceptance/quantify-market-data-gate1-check.sh BTCUSDT
bash scripts/acceptance/quantify-market-data-runtime.sh stop
```

上面这套流程用于验证：

- 前置条件齐全，不应误记为 `FAIL`
- `market-data` 真实连接 Binance REST / WS
- `quote` / `bars` 能落库、能查询、能与数据库对样
- `limit=abc`、`timeframe=abc`、不存在 symbol 等错误路径返回正确

## 建立连接

使用任意支持 SSE 的内部客户端连接：

```text
http://localhost:3010/api/v1/market/stream/ticker
```

如果服务已开始接收行情数据，会持续收到推送事件。

## 接入建议

- 内部模块可直接使用标准 SSE 客户端消费该端点
- 内部策略/AI 模块优先通过 `MarketDataReadGateway` 获取 bars/quote，避免分散直查 Prisma
- 调用方自行负责重连、节流和下游分发
- 当前服务不再提供浏览器前端专用接入说明或 CORS 配置

## 第二层扩展

当需要提测前或联调前检查时，再继续执行：

1. 完整通过第一层
2. 持续观察 `30~120` 分钟
3. 执行一次 `bash scripts/acceptance/quantify-market-data-runtime.sh restart`
4. 跑 `strategy-signals`、`strategy-instances`、`ai`、`trading(mock)` 的 smoke 测试
