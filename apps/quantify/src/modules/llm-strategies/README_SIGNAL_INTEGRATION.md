# LLM 策略信号集成到开仓流程

## 概述

LLM 策略生成的信号已经接入统一开仓链路，与旧版策略实例生成的信号共享同一套处理流程。

## 已实现能力

- 创建真实 `TradingSignal` 记录
- 关联 `llmStrategyId` 与 `llmStrategyInstanceId`
- 将 `generatedSignalId` 写回运行记录
- 保存价格、止损、止盈、仓位等完整信号数据
- 发出 `TradingSignalCreatedEvent`
- 触发下游开仓流程

## 模式差异

- `LIVE`：创建真实信号并进入后续交易流程
- `PAPER` / `BACKTEST`：仅记录运行日志，不触发真实交易

## 数据库变更要点

- 保留旧字段以兼容旧策略
- 增加 `llm_strategy_id` 与 `llm_strategy_instance_id`
- 增加必要索引与关联约束

## 关键约束

- `symbol` 为必填字段
- 只有 `LIVE` 模式才会触发真实信号和开仓流程
- 旧策略实例不受影响
- 事件系统保持一致，方便下游复用

## 调试建议

- 先确认信号解析是否成功
- 再确认模式是否为 `LIVE`
- 最后检查事件发出与下游消费日志
