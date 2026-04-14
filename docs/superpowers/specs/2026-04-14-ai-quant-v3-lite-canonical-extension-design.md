# AI Quant V3-Lite Canonical Extension Design

日期：2026-04-14

状态：设计已确认，待实现规划

## 1. 背景

当前 AI Quant 主链路已经稳定在：

`自然语言 -> clarification gate -> canonical spec -> semantic view -> confirm canonical snapshot -> IR -> AST -> compiled script -> publish -> publishedSnapshotId -> backtest -> report -> deploy`

现状已经证明两件事：

- `publishedSnapshotId` 作为 backtest 和 deploy 的唯一运行时真源是正确的
- `IR -> AST -> compiled script` 的确定性编译路线是正确的

但随着策略扩展需求增加，当前系统也出现了新的结构性瓶颈：

- 规则表达仍偏依赖“模板化文本识别”，扩展新策略时容易退化成 prompt 特判堆积
- 如果继续按“趋势型 / 网格型 / 状态型 / 组合型”一路扩展，会逐渐演变成新的参数库分类系统
- 缺少显式 normalization 层时，同一意图容易被归一成不同 canonical 表达
- 提示词仍混合承担“对话编排 / 语义收敛 / 展示解释 / 脚本生成”多个职责，边界不够清晰

本设计的目标不是重写主链路，而是在不破坏现有稳定执行链的前提下，把 canonical 层升级成可扩展的受控语义系统。

## 2. 目标

本次设计只解决以下目标：

1. 支持更多单腿策略。
2. 支持固定区间网格及其与趋势/状态条件的基础组合。
3. 支持最小状态语义集合：
   - `trend.direction`
   - `market.regime`
   - `volatility.state`
4. 把“按策略类型扩展”收敛为“按受控语义原子和 family 扩展”。
5. 保持同一策略意图可以稳定归一为同一 canonical snapshot family。
6. 保持 `publishedSnapshotId`、backtest、report、deploy 的一致性边界不变。

## 3. 非目标

本次明确不做：

1. 不重写主 pipeline。
2. 不引入新的确认后真相源。
3. 不让 semantic view 直接变成执行真源。
4. 不引入 `sequence` 时序条件。
5. 不引入 `multi_leg` 多腿策略执行。
6. 不支持动态移动网格、自适应波动网格或复杂事件驱动策略。
7. 不恢复“LLM 直接写正式发布脚本”作为正式链路。

## 4. 方案比较

### 4.1 方案 A：V2 增强版 / V3-Lite（采用）

做法：

- 保留现有主数据流和确认边界
- 保留 `publishedSnapshotId` 语义不变
- 在当前 canonical 层上增加 normalization、受控 atom 库、grid family、最小状态 atoms
- 继续编译到现有 IR / AST / compiled script

优点：

- 风险最低
- 最大化复用现有稳定执行链
- 可以逐步扩展支持范围
- 不会推翻已经跑稳的趋势策略和 snapshot 语义

代价：

- 结构上更像 `v3-lite` 或 `v2.5`
- 不追求一步到位的“全新 canonical 语言”

### 4.2 方案 B：新增独立 canonical spec v3，再编译回现有 IR（不采用）

不采用原因：

- 确认态、semantic view、IR 三层映射关系会显著复杂化
- 容易引入新的漂移面
- 当前收益不值得承担该迁移成本

### 4.3 方案 C：连确认态和执行链一起切到新 v3（不采用）

不采用原因：

- 会直接冲击现有已稳定的 `IR -> AST -> publishedSnapshotId -> backtest/deploy` 路线
- 对趋势策略、grid、报告和部署门禁的回归风险过大

## 5. 设计原则

### 5.1 强 normalization 优先于 atom 数量

atom 库不是越多越好；优先保证同义表达稳定收敛，再逐步扩 atom。

### 5.2 执行真相边界不变

- `publishedSnapshotId` 仍是 backtest / deploy 的唯一运行时真源
- 执行链不允许回读自由文本重新猜测语义

### 5.3 semantic view 只能解释事实，不能补充事实

semantic view 只能展示 normalized canonical truth，不允许二次创作。

### 5.4 IR 稳定优先

IR 可以做受控增量扩展，但不能让自由文本或 prompt 语义直接污染 AST / execution。

### 5.5 atom 库封顶

首批只支持闭环能力，不允许演化成“无限增长参数库 2.0”。

## 6. 顶层结构

用户理解层采用六桶语义：

1. `market`
2. `triggers`
3. `actions`
4. `risk`
5. `position`
6. `execution`

但实现上不直接推翻现有 `CanonicalStrategySpecV2.rules[]` 模型，而是：

- 对外：按六桶语义展示和确认
- 对内：仍允许通过受控 adapter 投影回现有 canonical / rules[] 表达，再编译到 IR

建议的顶层语义合同：

```ts
type CanonicalStrategySpecV3Lite = {
  version: 'v3-lite'
  market: {
    exchange: 'binance' | 'okx' | 'hyperliquid'
    symbol: string
    marketType: 'spot' | 'perp'
    timeframe: string
  }
  triggers: TriggerNode[]
  actions: ActionPolicy[]
  risk: RiskRule[]
  position: PositionPolicy
  execution: {
    signalTiming: 'BAR_CLOSE'
    fillTiming: 'NEXT_BAR_OPEN' | 'SAME_BAR_CLOSE' | 'INTRA_BAR_LIMIT_MATCH'
    orderTypeDefault: 'market' | 'limit'
    allowPartialFill: boolean
    timeInForce?: 'gtc' | 'ioc' | 'fok'
  }
  metadata: {
    normalized: true
    canonicalDigest: string
    sourceSchemaVersion: 'v2-compatible'
  }
}
```

该结构是语义合同，不要求立即变成所有 DTO/持久化的唯一物理 shape。

## 7. 首批支持范围

### 7.1 通用 trigger atoms

首批支持：

- `price.percent_change`
- `price.breakout_up`
- `price.breakout_down`
- `indicator.cross_over`
- `indicator.cross_under`
- `indicator.above`
- `indicator.below`
- `bollinger.touch_upper`
- `bollinger.touch_lower`
- `bollinger.touch_middle`
- `oscillator.rsi_gte`
- `oscillator.rsi_lte`

### 7.2 通用 action atoms

首批支持：

- `open_long`
- `open_short`
- `close_long`
- `close_short`
- `reduce_long`
- `reduce_short`

### 7.3 风控 atoms

首批支持：

- `risk.stop_loss_pct`
- `risk.take_profit_pct`
- `risk.max_drawdown_pct`
- `risk.cooldown_bars`
- `risk.max_single_loss_pct`

### 7.4 仓位 atoms

首批支持：

- `position.fixed_ratio`
- `position.fixed_quote`
- `position.fixed_qty`
- `position.mode.long_only`
- `position.mode.short_only`
- `position.mode.long_short`

### 7.5 组合能力

首批只支持：

- `AND`
- `OR`
- `NOT`

明确不支持：

- `sequence`

### 7.6 最小状态 atoms

首批只支持以下三类状态语义：

- `trend.direction`
- `market.regime`
- `volatility.state`

状态值必须来自固定白名单，不允许 prompt 发明新的状态枚举。

### 7.7 网格专属 family

固定区间网格不作为普通 trigger atom，而是作为首批特批 family：

- `grid.range_rebalance`

理由：

- 网格不是一次性 trigger -> action，而是持续运行的 order program
- 现有 IR 已经具备 `levelSets + orderPrograms` 结构，更适合表达网格

网格 family 首批支持：

- 固定区间双向网格
- 固定区间单向网格
- 趋势/状态门控的网格
- 带止损/止盈/最大回撤的网格

首批不支持：

- 动态移动网格
- 自适应波动网格
- 多品种 / 多腿网格

## 8. Normalization Layer

在现有流程中显式新增：

`clarification-resolved checklist -> normalization -> canonical snapshot -> semantic view -> confirm -> IR`

### 8.1 输入

Normalization 输入必须只来自“已澄清事实”，包括：

- 市场上下文：`exchange / symbol / marketType / timeframe`
- entry / exit 原始规则文本及已确认 basis / sideScope / window / indicator refs
- riskRules
- position
- clarificationAnswers

### 8.2 输出

Normalization 输出分为两层：

1. `normalizedIntent`
2. `canonicalPatch`

`normalizedIntent` 用于调试、审计、展示来源追溯。  
`canonicalPatch` 用于 canonical builder 的受控结构输入。

### 8.3 责任

Normalization 必须完成以下责任：

1. 同义表达收敛
2. basis 显式锁定
3. grid family 结构化
4. state atoms 结构化
5. canonical 排序稳定化
6. 归一失败时早暴露并阻断

### 8.4 失败策略

若某条规则无法稳定映射到首批 atom/family：

- 不进入 semantic view
- 返回明确 normalization blocker
- 回到 clarification gate 或 unsupported gate

禁止静默 fallback 成模糊规则。

## 9. 提示词分层重构

提示词不再只做“planner + codegen”双层，而改为四层职责：

### 9.1 Conversation Planner Prompt

职责：

- 维护上下文
- 输出增量 checklist patch
- 总结当前已确认事实
- 只追问一个最高优先级缺口
- 判断是否可进入 normalization

限制：

- 不发明新的 atom family
- 不补写核心规则
- 必答项或 basis 不清时，不得推进确认

### 9.2 Normalization Prompt

职责：

- 把已澄清事实收敛成受控 atom/family
- 明确 basis/default 解释来源
- 暴露 unresolved / conflict / unsupported

限制：

- 只能从白名单中选择 atom/family
- 不允许新增类型名

### 9.3 Semantic View Render Prompt

职责：

- 仅把 normalized canonical truth 转成用户可读说明

限制：

- 不能补充未存在的语义
- 不能把强语义弱化
- 必须可回指 canonical fields

### 9.4 Legacy Script Prompt

正式发布链不再依赖自由脚本生成。  
现有脚本 prompt 仅保留为：

- 调试
- 对照
- 回归辅助

不得重新成为正式发布真相源。

## 10. semantic view / confirm / IR / publish 一致性

### 10.1 semantic view

semantic view 必须：

- 只展示 normalized canonical truth
- 不再直接总结自由文本
- 显式展示 grid family、状态 atoms、组合条件

### 10.2 confirm canonical snapshot

确认态边界不变，但必须强化：

- 用户确认的是 normalized canonical snapshot 的展示版
- confirm 绑定 `canonicalDigest`
- digest 只取 canonical truth，不取展示文案

### 10.3 IR

IR 主结构保持稳定优先，新增能力应优先映射到既有结构：

- 通用 atoms -> `series / predicates / ruleBlocks / riskGuards`
- `grid.range_rebalance` -> `levelSets / orderPrograms`
- 状态 atoms -> 受控 predicate family

禁止：

- 让 IR 回读自由文本
- 为首批能力引入 `sequence`

### 10.4 AST / compiled script

AST 与 compiled script 仅做跟随式扩展：

- 保持确定性输出
- 不补充 canonical 中不存在的语义
- 继续校验 `canonical / IR / script` 等价

### 10.5 Published Snapshot

`publishedSnapshotId` 角色不变，但 snapshot 内容需要更完整反映 v3-lite canonical truth。

必须能从 snapshot 中回溯：

- normalized canonical truth
- grid/state/组合语义
- IR / AST / compiled projection / digest

### 10.6 backtest / report / deploy

backtest、report、deploy 的核心原则不变：

- backtest 仍通过 `publishedSnapshotId` 加载 snapshot 执行
- report 应能回显本次回测所基于的 canonical snapshot 语义
- deploy 仍由 report gate 控制，并且只消费 published snapshot truth，不重新解释自然语言

## 11. 对现有代码的主要改动位置

### 11.1 第一层：clarification / planner / prompts

重点文件：

- `prompts/conversation-planner-system.prompt.ts`
- `types/strategy-clarification.ts`
- `services/strategy-clarification-rules.service.ts`
- `services/strategy-clarification-question.service.ts`

### 11.2 第二层：Normalization Layer

重点位置：

- `types/codegen-checklist.ts`
- `services/canonical-spec-builder.service.ts`
- `services/rule-family-default-semantics.ts`

本层需要新增显式 normalization 逻辑，不再把主要语义识别散落在 builder 内部。

### 11.3 第三层：canonical / semantic view

重点位置：

- `types/canonical-strategy-spec-v2.ts`
- `services/strategy-summary-builder.service.ts`
- `services/strategy-summary-observation.service.ts`
- 会话/确认相关 DTO 组装逻辑

### 11.4 第四层：semantic graph / consistency

重点位置：

- `services/semantic-graph-builder.service.ts`
- `services/semantic-graph-validator.service.ts`
- `services/strategy-consistency.service.ts`

### 11.5 第五层：IR / AST / compiled script

重点位置：

- `types/canonical-strategy-ir.ts`
- `services/canonical-spec-v2-ir-compiler.service.ts`
- `services/canonical-strategy-ast-compiler.service.ts`

本层以扩映射为主，不做重写。

### 11.6 第六层：测试与回归样例

需要新增或补强：

- clarification tests
- normalization tests
- canonical builder tests
- semantic graph tests
- consistency tests
- grid/state-gated strategy fixtures

## 12. 工程规模判断

若严格按本设计范围实施：

- 不重写主 pipeline
- 不引入 `sequence`
- 不引入 `multi_leg`
- 只支持更多单腿 + `grid.range_rebalance` + 最小三类状态 atoms + 基础组合

则整体规模判断为：

`中等偏大，但可控`

分层判断：

- 上游理解层：改动大
- 中游 canonical / semantic：改动中等
- 下游 execution：改动小到中等

## 13. 风险与约束

### 13.1 风险：normalization 不够强，same intent 仍产出不同 canonical

缓解：

- 显式 normalization 层
- 稳定排序
- canonical digest 回归样例

### 13.2 风险：atom 库继续无限增长，重新退化成参数库分类系统

缓解：

- 首批能力封顶
- atom/family 准入门槛
- unsupported 先阻断，不仓促纳入

### 13.3 风险：semantic view 二次创作导致用户确认对象漂移

缓解：

- semantic view 只渲染 normalized truth
- confirm 绑定 canonical digest

### 13.4 风险：grid family 与通用 atoms 混淆，导致编译模型失真

缓解：

- grid 作为专属 family
- 优先映射到现有 `levelSets / orderPrograms`

### 13.5 风险：prompt 仍承担混杂职责

缓解：

- planner / normalization / semantic render / legacy script prompt 分层

## 14. 验收标准

本设计完成后，应满足以下结果：

1. 同一策略意图在不同自然语言表述下，可稳定收敛到同一 canonical family。
2. 趋势型、固定区间网格、趋势/状态门控网格、基础组合策略可以在正式链路中编译通过。
3. `semantic view -> confirm canonical snapshot -> IR -> AST -> compiled script -> publish` 全链路不再依赖自由文本补猜。
4. `publishedSnapshotId` 仍然是 backtest 和 deploy 的唯一运行时真源。
5. 不支持的策略会在 clarification / normalization / validation 阶段明确阻断，而不是带病进入回测或部署。

## 15. 结论

本设计采用 `方案 A`：在现有 AI Quant 主链路不变的前提下，引入 `v3-lite` 语义扩展、显式 normalization 层、grid 专属 family、最小状态 atoms，以及分层提示词合同。

它不是重写执行系统，而是把当前 canonical 层从“模板识别系统”升级为“受控语义系统”，以支持更多单腿策略和基础组合，同时保持已稳定的 `publishedSnapshotId` 执行边界不被破坏。
