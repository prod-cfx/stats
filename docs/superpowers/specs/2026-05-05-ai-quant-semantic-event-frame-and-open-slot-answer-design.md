# AI Quant Semantic Event Frame 与 Open Slot 回答闭环设计

日期：2026-05-05

## 背景

当前 AI Quant 主数据流已经收敛到 `triggers / actions / risk / position / context` 的原子语义和 contract-first readiness。contract 覆盖范围已经扩到主流策略表达，但公测策略测试暴露出两个结构性缺口：

1. 自然语言里的 trigger 与 action 绑定不稳定。
2. open slot 追问后的用户短回答没有回填到原 slot。

典型失败：

- `EMA7 上穿 EMA21 时开多；下穿时平多。` 第二句省略了 `EMA7/EMA21`，导致出场 trigger 丢失。
- `MACD 金叉买入死叉卖出。` 同一句包含两个 trigger-action 事件，但当前解析把整句动作污染成一个 exit。
- `15m 周期，价格区间 79200-80200，采用双向网格` 后追问内部文案；用户回复 `20格` 后，系统没有把它当作 `level_set.density` 的答案，继续重复追问。

这些不是 EMA、MACD、网格各自缺补丁，而是主数据流缺少一个通用事件层和一个通用 slot 回答闭环。

## 目标

- 在 atom patch 之前增加通用 `SemanticEventFrame` 层，用 `trigger + action` 统一表达自然语言事件。
- 支持一句话内多个 trigger-action 事件。
- 支持省略继承，例如 `下穿时平多` 继承前文 `EMA7 / EMA21`。
- 新消息进入时优先尝试关闭上一轮 open slot，再按新策略文本解析。
- 把内部 slot 文案转成用户可理解的业务问题。
- 不按策略族、family、key 打补丁，不扩大执行层能力。

## 非目标

- 不引入新的策略族模板。
- 不让 family 或 legacy checklist 重新成为 readiness 权威。
- 不默认替用户补网格密度。
- 不扩展网格、MACD、EMA 的执行能力，只修正理解与追问闭环。
- 不把不支持能力伪装成 open slot。

## 核心判断

值得做：这是主数据流里的真实结构问题。现有 contract readiness 能判断“能否执行”和“缺什么参数”，但缺少自然语言事件绑定与 open slot 回答回填，导致支持能力也无法稳定进入 projection gate。

关键洞察：

- 数据结构：用户自然语言先表达的是 `trigger + action` 事件，再落到 `triggers / actions` 列表。
- 复杂度：把 clause 级隐式规则集中到事件帧和 slot answer resolver，可以减少 extractor 里的特殊分支。
- 风险点：不能让事件帧绕过 contract readiness；它只能生成 atom patch，最终仍由 semantic state 和 projection gate 决定是否可生成。

## 方案比较

### 推荐方案：Semantic Event Frame + Open Slot Answer Resolver

新增轻量事件层和 slot 回答解析层：

`raw text -> open slot answer resolver -> semantic event frames -> atom patch -> semantic state -> support/readiness -> projection gate`

优点：

- 同时解决 EMA 省略、MACD 同句多事件、网格 short answer 闭槽。
- 与现有 `triggers / actions / risk / position / context` 命名一致。
- contract/readiness/projection 继续作为主流程权威。
- 可用 golden corpus 覆盖，回归边界清晰。

代价：

- 需要从 `SemanticSeedExtractorService` 中抽出一部分自然语言事件解析责任。
- conversation continue 阶段要优先尝试 slot answer resolver。

### 备选方案：继续增强 SemanticSeedExtractorService

在当前 extractor 里直接增加通用切分、省略继承、slot 回答识别。

优点：改动入口少，短期落地快。

缺点：extractor 已经承担 trigger、action、risk、position、context、unsupported、grid contract 等职责，继续堆逻辑会让主数据流更难维护。

### 备选方案：LLM 前置结构化归一

让 LLM 先输出结构化 semantic patch，再由后端校验。

优点：自然语言覆盖面可能更大。

缺点：确定性和可回归性弱，不适合作为这类主数据流一致性问题的根治方案。

## 设计

### 1. SemanticEventFrameParser

职责：把自然语言解析成一个或多个通用事件帧。

事件帧字段：

```ts
interface SemanticEventFrame {
  id: string
  trigger: SemanticEventTrigger
  action: SemanticEventAction
  sideScope: 'long' | 'short' | 'both'
  phase: 'entry' | 'exit'
  evidenceText: string
  inheritedFrom?: string
}
```

命名统一使用 `trigger + action`，避免再引入 `condition` 作为平行概念。

事件帧解析规则：

- 一个自然句可以产生多个事件，例如 `MACD 金叉买入死叉卖出` 产生 entry 与 exit 两个事件。
- trigger 与 action 按最近邻绑定，`买入` 不污染 `死叉卖出`，`卖出` 不污染 `金叉买入`。
- 省略 trigger 可以继承上一可兼容事件的 operand pair，例如 `下穿时平多` 继承 `EMA7 / EMA21`。
- 继承只允许在同一用户消息或同一持续编辑上下文中发生，不能跨无关策略污染。
- 继承后必须在事件帧上保留 `inheritedFrom` 和原始 evidence，便于调试和测试。

### 2. SemanticEventFrameProjector

职责：把事件帧投影到现有 atom patch。

规则：

- entry long -> `indicator.cross_over` 等 trigger + `open_long`。
- exit long -> 对应 trigger + `close_long`。
- entry short -> trigger + `open_short`。
- exit short -> trigger + `close_short`。
- 投影出的 atom 必须继续挂载 contract，由现有 support classifier 和 readiness 判断。
- 如果事件帧不能稳定投影为现有 atom，进入 `recognized_unsupported` 或 `unsupported_unknown`，不能降级成 legacy checklist。

### 3. SemanticOpenSlotAnswerResolver

职责：新消息进来时，优先尝试解析为上一轮 open slot 的答案。

入口规则：

- 当 persisted `SemanticState` 存在 open slot 时，先按 slotKey/fieldPath 解析用户回复。
- 成功解析后，更新原 semantic node 或 contract shape，再重新跑 readiness。
- 解析失败时，再把消息当作新策略文本走 event frame / extractor。

网格密度 slot 支持：

- `20格` / `20 个网格` / `网格数量 20` -> `gridCount: 20`
- `20个间隔` / `20 段` -> `gridIntervals: 20`，并派生 `gridCount: 21`
- `每格 100 USDT` / `间距 100` -> `absoluteSpacing: 100`
- `每格 0.5%` / `步长 0.5%` -> `spacingPct: 0.5`
- 如果用户同时给出多个密度字段，按 contract shape normalizer 校验一致性。

冲突处理：

- 对 fixed range，若 `gridCount` 与 `absoluteSpacing` 不一致，进入同一个 conflict slot。
- 文案必须是业务语言：`网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。`
- 不暴露 `level_set`、`density`、`contract.shape` 等内部词。

### 4. SemanticClarificationQuestionRenderer

职责：把内部 slot 渲染成用户可理解的追问。

文案映射：

- `contract.shape.price.level_set.density`
  - `请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。`
- `contract.shape.price.level_set.spacing_conflict`
  - `网格数量和每格间距与当前价格区间不一致，请确认保留网格数量还是每格间距。`
- `contract.requirement.price.define.level_set`
  - `请补充网格价格区间和网格数量或每格间距。`

所有 semantic slot 的默认兜底文案都必须避免内部工程词。若没有业务文案，说明该 slot 不应直接对用户开放。

## 数据流

1. 用户输入进入 conversation continue。
2. 若存在 open slot，`SemanticOpenSlotAnswerResolver` 先尝试关闭 slot。
3. 若 slot 关闭成功，合并到 persisted semantic state，重新跑 support/readiness/projection gate。
4. 若没有可关闭 slot，`SemanticEventFrameParser` 解析 trigger-action 事件。
5. `SemanticEventFrameProjector` 生成 atom patch。
6. 原有 semantic state builder、support classifier、contract readiness、projection gate 继续执行。
7. 需要追问时，由 `SemanticClarificationQuestionRenderer` 输出业务文案。

## 错误处理

- 事件帧存在 trigger 但 action 缺失：生成 open semantic action slot，用业务文案追问动作。
- 事件帧存在 action 但 trigger 缺失：生成 open semantic trigger slot，用业务文案追问触发条件。
- 省略继承找不到兼容前文：不猜测，生成 trigger open slot。
- slot answer 解析出多个可能值且互斥：生成 semantic conflict slot。
- recognized unsupported 仍走 unsupported fallback，不进入 open slot。

## 测试

新增或扩展以下测试：

- extractor/event frame unit：
  - `EMA7 上穿 EMA21 时开多；下穿时平多。`
  - 期望 entry `indicator.cross_over` + exit `indicator.cross_under`，并保留 EMA 7/21。
- extractor/event frame unit：
  - `OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出。`
  - 期望 entry MACD cross_over + exit MACD cross_under。
- conversation-level regression：
  - 第一轮：`15m 周期，价格区间 79200-80200，采用双向网格`
  - 期望追问业务文案：`请确认网格数量或每格间距，例如 20 格 / 每格 100 USDT / 每格 0.5%。`
  - 第二轮：`20格`
  - 期望关闭 `contract.shape.price.level_set.density`，写入 `gridCount: 20`，不重复同一追问。
- conflict regression：
  - 固定区间 79200-80200，用户回复 `20格，每格100 USDT`
  - 期望进入 conflict slot，并输出业务文案。
- golden corpus：
  - 将上述三条加入 atom coverage corpus，确保 route 从 open slot 正常推进。

## 验收标准

- 三个用户样例不再出现错误理解或内部追问文案。
- 网格用户回复 `20格` 后不会重复追问同一句。
- 生成前仍由 semantic contract readiness 和 projection gate fail closed。
- 代码中不新增按策略族或 family 决定 readiness 的路径。
- 旧的 contract-first 覆盖与 unsupported fallback 行为不回退。
