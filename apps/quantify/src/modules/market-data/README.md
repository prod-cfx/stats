# 市场数据模块

## 概述

本模块负责采集行情数据、写入存储，并通过 `GET /market/stream/ticker` 向内部调用方提供 SSE 实时推送。

## 使用方式

1. 在仓库根目录执行 `dx db generate quantify --dev`
2. 启动服务：`dx start quantify --dev`
3. 在内部调用方连接 `http://localhost:3010/api/v1/market/stream/ticker`

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

## 故障排查

- 连接失败：确认 quantify 服务已经启动，且调用方可访问 `/api/v1/market/stream/ticker`
- 没有数据：检查 Binance WebSocket 连接状态与 market-data 模块日志
- 频繁断线：检查内部网络、代理超时与调用方重连逻辑
