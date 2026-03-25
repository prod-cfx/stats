# 2026-03-25 Backtesting Capabilities (Global Config) Design

## 背景

前端已接入 `GET /backtesting/capabilities` 并依赖返回的 `allowedSymbols` 与 `allowedBaseTimeframes` 做参数门禁，但后端尚未实现该接口，导致能力读取失败后只能走前端降级行为。

本次确认结论：

- 能力来源：数据库
- 生效粒度：全局公用（非 userId 维度）
- 无配置行为：返回空数组（不抛业务错误）

## 目标

1. 在 quantify 后端落地 `GET /backtesting/capabilities`。
2. 能力值由数据库单一真相提供。
3. 保持前端契约不变：
   - `allowedSymbols: string[]`
   - `allowedBaseTimeframes: string[]`
4. 无激活配置时返回空数组，接口仍为 200。

## 方案总览

采用“全局配置表 + 读取服务”方案：

1. 新增全局回测能力配置表，仅保存全局白名单。
2. Backtesting 模块新增 repository/service，读取当前激活配置。
3. Controller 新增 `GET /backtesting/capabilities` 并返回规范化结果。
4. 对脏数据做防御性降级（字段非法时返回空数组）。

## 数据模型设计

建议新增模型（示例名）：`BacktestCapabilityConfig`

字段：

- `id: String @id @default(cuid())`
- `allowedSymbols: Json @map("allowed_symbols")`
- `allowedBaseTimeframes: Json @map("allowed_base_timeframes")`
- `isActive: Boolean @default(true) @map("is_active")`
- `createdAt: DateTime @default(now()) @map("created_at")`
- `updatedAt: DateTime @default(now()) @updatedAt @map("updated_at")`

约束：

- 读取策略为“仅取激活配置中的最新一条”（避免历史脏数据影响）
- 运维约定只保持一条 `is_active=true`

## 接口契约

### 路由

- `GET /backtesting/capabilities`

### 成功返回（有配置）

```json
{
  "allowedSymbols": ["BTCUSDT", "ETHUSDT"],
  "allowedBaseTimeframes": ["15m", "1h"]
}
```

### 成功返回（无配置）

```json
{
  "allowedSymbols": [],
  "allowedBaseTimeframes": []
}
```

### 失败返回

- 仅系统异常（DB 连接/查询异常）返回 5xx
- “未配置”不作为异常

## 组件职责

### BacktestCapabilitiesRepository

- 负责查询当前激活配置（`isActive=true`，按 `updatedAt` 倒序取首条）

### BacktestCapabilitiesService

- 负责 DTO 归一化：
  - 将 JSON 字段解析为 `string[]`
  - 非法类型降级为 `[]`
- 输出稳定结构 `{ allowedSymbols, allowedBaseTimeframes }`

### BacktestingController

- 新增 `getCapabilities()` 入口
- 复用现有 backtesting 模块，不改变 `run/jobs` 行为

## 错误处理与防御

1. 表中无激活配置 -> 返回空数组。
2. 字段类型异常（非字符串数组）-> 记录 warning，并对该字段返回空数组。
3. 查询异常 -> 抛系统异常，交由全局异常过滤器处理。

## 测试策略（需求驱动）

### Happy path

- 有激活配置时返回对应 symbol/timeframe。

### Edge cases

- 无激活配置返回空数组。
- 字段类型异常返回空数组。

### Error handling

- repository 抛异常时，controller 层表现为 5xx（单元测试可断言抛出）。

### State / Selection

- 多条配置并存时，仅使用“最新激活”记录。

## 非目标（YAGNI）

- 不做管理后台配置页面。
- 不做 userId/accountId 粒度能力。
- 不做缓存层与热更新通知。

## 验收标准

1. `GET /backtesting/capabilities` 在 quantify 后端可用。
2. 响应字段与前端当前契约完全一致。
3. 无配置时返回空数组而非业务错误。
4. 单测覆盖：有配置、无配置、脏数据、选择逻辑。
