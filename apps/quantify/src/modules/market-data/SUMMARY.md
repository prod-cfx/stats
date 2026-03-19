# 市场数据模块摘要

## 当前能力

- 采集并持久化行情数据
- 提供内部 SSE 实时推送接口
- 支持多订阅方同时消费
- 提供统一读侧契约 `MarketDataReadGateway` 供策略与 AI 模块消费
- 支持 `SPOT/PERP` 双市场 symbol 编码与兼容读取（`<RAW_SYMBOL>:SPOT|PERP`）
- 提供最小真实链路验收脚本：`scripts/acceptance/quantify-min-acceptance.sh`

## 适用场景

- 内部服务订阅 ticker 流
- 调试行情接入链路
- 为策略或下游模块提供统一行情入口

## 后续方向

- 完善监控指标
- 补充更多接入样例
- 强化异常恢复与告警
