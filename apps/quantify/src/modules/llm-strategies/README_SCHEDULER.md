# LLM 策略实例动态 Cron 调度系统

## 概述

`LlmStrategyInstance` 支持实例级别的动态 Cron 调度。系统会在实例启动、停止、更新和服务重启时自动维护调度任务。

当前实现以这两处代码为准：

- [llm-strategy-instance-scheduler.service.ts](/Users/a1/work/stats/apps/quantify/src/modules/llm-strategies/services/llm-strategy-instance-scheduler.service.ts)
- [llm-strategy-instances.service.ts](/Users/a1/work/stats/apps/quantify/src/modules/llm-strategies/services/llm-strategy-instances.service.ts)

## 核心行为

- 实例从非 `running` 切到 `running` 时，会自动创建并启动 Cron 任务
- 如果实例没有设置 `scheduleCron`，调度器会回退到默认表达式 `*/15 * * * *`
- 实例停止或暂停时，自动停止并清理对应任务
- 服务重启时，自动恢复处于 `running` 状态且关联策略仍为 `live` 的实例
- 更新 `scheduleCron` 时，若实例正在运行，则自动重建调度任务
- 将 `scheduleCron` 清空时，若实例正在运行，会停止自动调度，但实例仍可保留 `running`
- 同一实例存在执行锁；若上一次执行未结束，本次 cron tick 会被跳过以避免并发执行

## 调度服务职责

- 管理所有 LLM 实例级别的 Cron 任务
- 实现 `OnModuleInit` 与 `OnModuleDestroy` 生命周期钩子
- 提供启动、停止、重启、恢复实例调度的方法

## 使用说明

### 创建实例并配置 Cron

```json
{
  "scheduleCron": "*/10 * * * *"
}
```

实例创建后若状态为 `paused`，不会自动执行；切换到 `running` 后才会开始调度。

如果创建时不传 `scheduleCron`，实例在进入 `running` 后会使用默认 Cron。

### 更新 Cron

```json
{
  "scheduleCron": "*/20 * * * *"
}
```

如果实例正在运行，系统会自动重启调度任务。

### 清除 Cron

将 `scheduleCron` 设为空后，如果实例正在运行，系统会停止对应调度任务。

## 特点

- 支持实例级别自定义调度频率
- 未显式配置时可回退到默认 Cron
- 支持热更新 Cron 表达式
- 支持服务重启后的任务恢复
- 支持手动触发，且手动触发可绕过调度限制
- 支持运行中并发保护

## 监控建议

- 记录任务创建、停止、恢复日志
- 暴露当前运行中的实例数量
- 监控 Cron 执行失败和跳过情况
