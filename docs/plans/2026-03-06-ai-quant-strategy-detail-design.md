# AI量化个人中心策略详情优先设计

## 1. 背景与范围
- 背景：当前个人中心 `AI量化` 仅有入口与 API 配置，尚无“已部署/运行中策略”的可视化管理。
- 本轮目标：先完成“策略详情优先”的前端 MVP，支持列表进入详情并展示关键表现数据。
- 边界：仅前端 mock，不接后端；不做暂停/恢复/停止操作；不做移动端。

## 2. 方案结论
- 采用方案A：策略列表 + 独立详情页 + 本地 mock store（localStorage）。
- 指标采用第1组：收益率、最大回撤、胜率、交易次数。

## 3. 信息架构
### 3.1 个人中心 AI量化 Tab
- 显示“我的策略”列表（mock seed）。
- 每条策略提供 `查看详情` 操作。
- 列表项显示状态：`running` / `stopped` / `draft`。

### 3.2 策略详情页
- 路由：`/[lng]/account/ai-quant/strategy/[id]`。
- 区块：
  - 概览指标卡（4项）
  - 收益曲线
  - 参数快照（交易所、币种、周期、仓位）
  - 运行时间线（创建、回测通过、部署、运行）

## 4. 数据模型与状态
### 4.1 策略实体（Mock）
- `id`
- `name`
- `status`: `running | stopped | draft`
- `exchange` / `symbol` / `timeframe` / `positionPct`
- `metrics`: `returnPct` / `maxDrawdownPct` / `winRatePct` / `tradeCount`
- `equitySeries`: `{ ts, value }[]`
- `timeline`: `{ at, event, note }[]`
- `updatedAt`

### 4.2 存储与容错
- key：`ai_quant_strategy_store_v1`
- 首次访问：写入 seed（3-5条策略）
- 存储异常：自动恢复 seed 并提示
- 列表与详情共用同一 store

### 4.3 状态流转
- 本轮仅只读展示，状态由 mock seed 预置。
- 流转语义保留：`draft -> running -> stopped`，为下一轮操作按钮预留。

## 5. UI与交互细节
### 5.1 列表
- 显示：策略名、状态标签、更新时间。
- 次级信息：交易所 / 交易对 / 周期 / 仓位。
- 操作：`查看详情`。
- 状态颜色：running 绿、stopped 灰、draft 琥珀。

### 5.2 详情
- 顶部：标题 + 状态 + 返回列表。
- 第一屏：4个指标卡。
- 第二屏：收益曲线（沿用 Coinflux 深色视觉 token）。
- 第三屏：参数快照 + 时间线。

### 5.3 空态与异常态
- 列表空态：`暂无策略` + `去 AI量化创建`（跳 `/[lng]/ai-quant`）。
- 详情缺失：`策略不存在或已删除` + 返回列表。
- store 解析失败：自动回退 seed，并显示轻提示。

## 6. 与现有 AI 对话链路关系
- 本轮不做自动桥接：部署成功不会自动写入个人中心策略 store。
- 下一轮再接：`DeployDialog` 成功后落策略数据到 `ai_quant_strategy_store_v1`。

## 7. 验收标准
1. 打开 `/<lng>/account?tab=ai-quant` 可见策略列表（mock seed）。
2. 点击 `查看详情` 可进入 `/<lng>/account/ai-quant/strategy/[id]`。
3. 详情页展示 4 项指标、收益曲线、参数快照、时间线。
4. 刷新页面后数据保持（localStorage）。
5. 非法/不存在 id 有友好空态，页面不报错。
6. 视觉风格与 Coinflux 现有 `--cf-*` token 一致。
