# 图表库收敛评估（Issue #621）

## 背景

- Parent: #617
- Issue: #621 `[front/perf] 评估 3 个图表库（echarts + lightweight-charts + recharts）收敛可行性`
- 目标：明确每个图表库的真实使用场景、不可替代能力、收敛建议，以及可执行的迁移顺序。

## 当前使用清单

### `lightweight-charts`

| 文件 | 场景 | 当前职责 | 结论 |
| --- | --- | --- | --- |
| `apps/front/src/components/trading/center-chart-panel/TradingViewLightweightChart.tsx` | 交易中心主图 | K 线、成交量/指标副图、十字线、可见区间同步、价格坐标映射、清算热力覆盖层联动 | 不建议替换 |
| `apps/front/src/components/trading/chart-adapter/lightweight-chart-adapter.ts` | 图表适配层 | 封装 `priceToCoordinate` / `coordinateToPrice` / crosshair / visible-range 订阅 | 不建议替换 |

### `echarts` + `echarts-for-react`

| 文件 | 场景 | 当前职责 | 结论 |
| --- | --- | --- | --- |
| `apps/front/src/components/liquidation-map/LiquidationMapChart.tsx` | 清算地图 | 堆叠柱、双 Y 轴、dataZoom、markLine、overlay graphic | 核心能力，建议保留 |
| `apps/front/src/components/aggregated-orderbook/DepthChart.tsx` | 深度图 | 双侧阶梯线 + 面积渐变 + tooltip | 可迁移，但无高优先级 |
| `apps/front/src/components/whale-tracking/profile/PnLTrendChart.tsx` | PnL 趋势 | 单折线 + area + 0 轴 markLine | 可迁移，但无高优先级 |
| `apps/front/src/components/whale-tracking/profile/ProfileSummary.tsx` | 资产占比卡片 | 小型 donut | 可替换为更轻方案 |
| `apps/front/src/components/whale-tracking/WhaleTradingStatsModal.tsx` | 交易统计弹窗 | 小型 donut | 可替换为更轻方案 |
| `apps/front/src/components/charts/LazyReactECharts.tsx` | 共享包装层 | 懒加载 React 包装器 | 应继续复用 |
| `apps/front/src/components/charts/echarts-runtime.ts` | 共享运行时 | 仅注册 line/bar/pie + tooltip/grid/legend/dataZoom/markLine | 已做按需收敛，建议保留 |

### `recharts`

| 文件 | 场景 | 当前职责 | 结论 |
| --- | --- | --- | --- |
| `apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.tsx` | AI Quant 回测报告 | `ResponsiveContainer + ComposedChart + Area + Line + Tooltip` | 最适合迁出 |

## 不可替代能力评估

### `lightweight-charts` 的不可替代点

`TradingViewLightweightChart.tsx` 不是普通折线图组件，而是交易图表基础设施：

- 直接承载 `CandlestickSeries` 主 K 线和多类副图 series。
- 依赖 `subscribeCrosshairMove`、`subscribeVisibleLogicalRangeChange` 做主图与副图联动。
- 依赖 `priceToCoordinate` / `coordinateToPrice` 将价格轴映射到像素，用于右侧清算覆盖层定位。
- 交易场景对滚动、缩放、十字线和价格轴交互的要求明显高于报表类图表。

结论：`lightweight-charts` 在交易主图场景不可替代。若强行统一到 `echarts` 或 `recharts`，不是“换一个组件”，而是重写交易图表交互层。

### `echarts` 的不可替代点

`LiquidationMapChart.tsx` 已经使用了 `echarts` 的一组组合能力：

- 多组堆叠柱 + 双 Y 轴。
- `dataZoom` 滑块和 inside zoom。
- `markLine` 当前价标记。
- `graphic.LinearGradient` 与自定义 `graphic` overlay。

结论：在“清算地图”这个页面上，`echarts` 不是纯展示层，而是复杂组合图能力提供者。即使理论上可迁移，也不应作为当前收敛第一目标。

### `recharts` 的可替代性

`BacktestReportClient.tsx` 中的 `recharts` 用法相对孤立，且只覆盖：

- 单个 `ComposedChart`
- 一条净值线
- 一块回撤 Area
- 常规坐标轴、Tooltip、ResponsiveContainer

这类能力完全能由现有 `echarts-runtime.ts` 继续扩展承载，迁移成本和回归面都明显低于迁移交易主图或清算地图。

## 收敛建议

### 建议保留的图表库

- 保留 `lightweight-charts`
- 保留 `echarts`
- 淘汰 `recharts`

也就是说，从 3 套收敛到 2 套，而不是尝试收敛到 1 套。

## 为什么不建议收敛到单一图库

### 方案 A：只保留 `echarts`

不建议。原因：

- 交易主图的 K 线交互、价格轴映射、副图同步是 `lightweight-charts` 的强项。
- 当前已有适配层和覆盖层联动代码，替换将带来高风险重写。
- 收益主要只有“少一个依赖”，但代价是重写核心交易体验。

### 方案 B：只保留 `lightweight-charts`

不建议。原因：

- `lightweight-charts` 擅长金融时序图，不擅长清算地图这种多序列组合图。
- 现有 donut、深度图、PnL 曲线勉强能迁，但 `LiquidationMapChart.tsx` 的 dataZoom、stack、graphic 组合成本很高。
- 会把简单问题变成“围绕单一库重写所有非金融图表”。

### 方案 C：保留 `lightweight-charts + echarts`

建议采用。原因：

- 与现有代码边界一致。
- 可以直接消除 `recharts` 这类孤立依赖。
- 保留交易主图和复杂组合图的最佳适配库。

## 建议迁移顺序

### Phase 1：迁出 `recharts`

目标：将 `apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.tsx` 改为 `echarts`。

建议做法：

- 新增一个面向回测报告的 `ECharts` 组件，而不是把配置直接堆在页面文件里。
- 在 `echarts-runtime.ts` 维持按需注册，只补回测页真正需要的模块。
- 保持 UI 文案、主题色、tooltip 语义和坐标轴格式不变，降低回归风险。

预期收益：

- 直接移除 `recharts` 依赖。
- 图表库数量从 3 降到 2。
- 回测报告与其余报表图统一到同一套运行时。

### Phase 2：清理轻量展示图

目标：评估是否把两个小型 donut 改成 CSS/SVG，而不是继续占用 `echarts-for-react`。

候选：

- `ProfileSummary.tsx`
- `WhaleTradingStatsModal.tsx`

说明：

- 这一步不会进一步减少“图表库数量”，但可能降低 `echarts-for-react` 的渲染负担。
- 由于 `LiquidationMapChart.tsx` 和 `DepthChart.tsx` 仍需 `echarts`，这一阶段优先级低于 Phase 1。

### Phase 3：按页面 ROI 决定是否继续收口

候选：

- `PnLTrendChart.tsx`
- `DepthChart.tsx`

说明：

- 这两处即使保留在 `echarts`，也不影响“3 -> 2”这一核心目标。
- 是否继续抽象为统一 chart option builder，取决于后续是否要复用主题/tooltip 规范。

## 风险与边界

- 不要把 `TradingViewLightweightChart.tsx` 纳入本轮迁移范围。
- 不要先动 `LiquidationMapChart.tsx`；它是 `echarts` 保留价值最高的页面。
- 若后续执行 Phase 1，需要补充回测页视觉回归和交互回归，避免 tooltip、缩放、自适应高度行为变化。

## 结论

Issue #621 的最优收敛策略不是“强行单库化”，而是：

1. 保留 `lightweight-charts` 作为交易主图引擎。
2. 保留 `echarts` 作为复杂组合图和通用业务图表引擎。
3. 将 `recharts` 从回测报告页迁出，完成 3 套图表库到 2 套图表库的收敛。

这条路线改动最小、风险最低、收益最确定，也和当前代码中的职责边界一致。
