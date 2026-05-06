# AI Quant Atom-Native Normalization 与 Slot Fulfillment 设计

日期：2026-05-05

## 背景

当前 AI Quant 主数据流已经收敛到 `triggers / actions / risk / position / contextSlots`，并且 contract 覆盖已经扩到主流策略表达。但测试暴露出两个仍在主链路里的结构性缺口：

1. 首轮自然语言没有稳定落到现有 atom。
2. 后续用户补充没有稳定关闭上一轮 open semantic slot。

典型探针：

```text
15min 1h 4h 价格都在 ema20 的上方 买入
```

这不应该被当成某个 EMA 策略族，也不应该新增一个条件框架层。它应该直接进入现有主数据流：

- 多个 entry trigger：`indicator.above`，分别带 `params.timeframe = 15m / 1h / 4h`
- 一个 action：`open_long`
- 多 trigger 默认 AND
- 缺少主执行周期、交易所、标的、仓位等信息时走 context/position open slot

后续补充探针：

```text
15min k线在 ema20 上方开多
```

当上一轮 state 存在 `semantic.missing_entry_atom` 或 `trigger.entry` open slot 时，这句话不是普通聊天，也不是简单 slot value，而是一个完整的 entry semantic fragment。系统必须解析它、合并它、替换 missing placeholder，然后重新跑 support/readiness/projection。

## 目标

- 保持唯一主数据流：`triggers / actions / risk / position / contextSlots`。
- 不新增并行的 condition frame、策略族模板、legacy checklist 或 key-specific patch 层。
- 建立 atom-native normalization，使所有策略表达先按原子槽位归一，再直接生成 `CodegenSemanticPatch`。
- 支持多周期 trigger：每个 trigger 可携带自己的 `params.timeframe`，多个 trigger 默认 AND。
- 把 open semantic slot fulfillment 扩展到完整 semantic fragment，而不只处理网格密度这类短回答。
- 消除 extractor、registry、contract readiness、projection 之间的支持状态分裂。
- 用原子语义维度构建测试矩阵，避免按策略族补洞。

## 非目标

- 不引入新的策略族识别器。
- 不新增独立的条件框架层作为中间真相源。
- 不恢复 checklist 作为 readiness 或 clarification 权威。
- 不把当前无法执行的能力伪装成 open slot。
- 不静默删除用户表达中的 unsupported atom 后部分生成。
- 不要求用户必须一次性说完整策略；后续补充必须是一等路径。

## 核心判断

值得做：这是主数据流真实问题，不是 EMA 或多周期的孤立 bug。当前实现里 extractor 分支、open slot answer resolver、missing placeholder、support registry、projection 能力之间仍有断裂。只修探针会让下一类 RSI、MACD、布林边界、通道、前高前低或风控表达继续漏。

关键洞察：

- 数据结构：现有 `triggers/actions/risk/position/contextSlots` 足够表达该策略，不需要新增业务层。
- 复杂度：应该把散落在 extractor 里的词法分支收敛成面向 atom slot 的 normalization，而不是继续堆策略族或 key 分支。
- 风险点：如果只改 extraction，不改续写补槽、placeholder 清理和 support/projection 一致性，用户仍会看到“已补入场条件但系统继续问入场条件”。

## 方案比较

### 推荐方案：Atom-Native Normalization + Open Semantic Slot Fulfillment

主数据流：

```text
user message
-> semantic seed extraction / open slot fulfillment
-> CodegenSemanticPatch
-> SemanticState merge/reduce
-> support classifier
-> contract readiness
-> projection gate
-> canonical / IR / AST / script
```

首轮消息走 atom-native normalization，直接写入现有 atom patch。续写消息在存在 open semantic slot 时优先尝试 fragment fulfillment，成功后合并真实 atom 并清理 missing placeholder。

优点：

- 不新增并行真相源，符合当前主数据流。
- 同时解决首轮识别失败和后续补充失败。
- 后续其他策略按原子语义维度扩展，而不是按策略族补洞。
- 可以用一致性测试约束 extractor、registry、contract、projection。

代价：

- 需要整理 `SemanticSeedExtractorService` 中已经膨胀的局部分支。
- 需要扩展 `SemanticOpenSlotAnswerResolverService`，让它能处理 semantic fragment。
- 需要补齐多周期 projection 与 validation。

### 备选方案：继续增强 extractor 分支

给 `15min`、`在 EMA20 上方`、裸多周期列表和后续补充逐个加规则。

优点：短期改动少。

缺点：下一类表达会继续漏；续写补槽、placeholder 清理和支持状态分裂仍可能失败。

### 备选方案：LLM 前置结构化

让 LLM 先输出 atom patch，后端只做校验。

优点：自然语言覆盖面可能更广。

缺点：确定性和回归性弱，不适合作为公测主链路的根治方案。可以作为未来辅助，不作为本轮主方案。

## 设计

### 1. SemanticSeedExtractorService：Atom-Native Normalization

`SemanticSeedExtractorService` 继续是首轮 seed patch 入口，但内部职责从“按局部策略词分支抽取”收敛为“按目标 atom slot 归一”。

归一维度：

- timeframes：`15min`、`15 mins`、`15m`、`15 分钟`、`1h`、`4小时`
- subject：`价格`、`K线`、`K线价格`、`收盘价`
- relation：`在...上方`、`高于`、`站上`、`突破`、`上穿`、`低于`、`跌破`、`下穿`
- reference：`EMA20`、`MA20`、`SMA20`、`RSI 70`、`布林上轨`、`通道下沿`
- action：`买入`、`开多`、`做多`、`卖出`、`平多`、`开空`、`平空`
- scope words：`都`、`同时`、`并且`、`且` 表示 AND

输出仍是 `CodegenSemanticPatch`，不产生新模型：

```ts
{
  triggers: [
    {
      key: 'indicator.above',
      phase: 'entry',
      sideScope: 'long',
      params: {
        indicator: 'ema',
        'reference.period': 20,
        timeframe: '15m'
      }
    }
  ],
  actions: [{ key: 'open_long' }]
}
```

多周期表达规则：

- 裸周期列表与同一谓词绑定，例如 `15min 1h 4h 价格都在 EMA20 上方`。
- 每个周期生成一个 trigger，不能只写入全局 `contextSlots.timeframe`。
- 多 trigger 默认 AND。
- 若用户同时给出主执行周期和观察周期，主执行周期进入 `contextSlots.timeframe`，观察周期进入 trigger params。
- 若只有观察周期列表但没有主执行周期，projection 可使用最小周期作为默认执行周期时必须有明确规则；否则产生 `contextSlots.timeframe` open slot，不能误报缺 entry atom。

### 2. SemanticOpenSlotAnswerResolverService：Semantic Fragment Fulfillment

现有 resolver 主要处理网格 level-set density。它需要扩展为通用 open semantic slot 入口：

```text
current SemanticState has open semantic slot
-> user follow-up
-> try structured slot answer
-> try semantic fragment extraction against target slot
-> if fulfilled, merge fragment and close/supersede owning placeholder
-> rerun support classifier, contract readiness, projection gate
```

适用 open slot：

- `semantic.missing_entry_atom`
- `semantic.missing_exit_atom`
- `trigger.entry`
- `trigger.exit`
- trigger contract required slots
- action intent slots
- risk slots
- position sizing slots
- context slots

示例：

```text
上一轮：semantic.missing_entry_atom open
用户：15min k线在 ema20 上方开多
结果：
- 新增 entry indicator.above trigger
- 新增或保留 open_long action
- supersede/remove semantic.missing_entry_atom
- 继承已有 exchange/symbol/marketType/risk/position/context
```

失败规则：

- 如果 fragment 只含 action，不含 trigger，`semantic.missing_entry_atom` 保留。
- 如果 fragment 能抽成 atom 但 support/projection 不支持，不能继续问“请补充入场条件”，必须进入真实 unsupported 或 projection failure。
- 如果 fragment 与当前 session 明确冲突，生成 conflict slot 或要求确认替换。

### 3. Missing Placeholder Reconciliation

在 semantic merge/reduce 后增加 missing placeholder reconciliation：

- 真实 user trigger 高于 derived missing trigger。
- 已有 locked/open 的真实 entry trigger 时，`semantic.missing_entry_atom` 必须被移除或标记 `superseded`。
- 已有 locked/open 的真实 exit trigger 时，`semantic.missing_exit_atom` 必须被移除或标记 `superseded`。
- placeholder 不能和满足同一 phase 的真实 trigger 同时阻塞 readiness。
- 如果真实 trigger 本身还有 open contract slots，应追问这些具体 slots，而不是回到 missing atom。

### 4. SemanticStateMerge / Reducer

合并层必须支持 fragment 补全：

- 新 fragment 可只包含当前 open slot 对应的局部语义。
- 已有 context、risk、position 不因 fragment 缺省而丢失。
- 同 phase、sideScope、key、reference、timeframe 的 trigger 去重。
- 新真实 atom 与旧 derived placeholder 冲突时，真实 atom 胜出。
- patch merge 后必须重新运行 support classifier 和 contract readiness。

### 5. Support Truth Alignment

建立能力一致性门禁：

```text
extractable
-> registry supportStatus
-> contract requirements/openSlots
-> projection support
```

同一个 atom 不允许出现这些分裂：

- extractor 能抽，registry 标 unsupported，但 canonical builder 已有投影逻辑。
- registry 标 supported，但 contract readiness 永远无法关闭 required slot。
- contract readiness 通过，但 projection gate 报 unsupported condition。
- projection failure 被用户文案包装成缺 entry/exit atom。

`indicator.above` / `indicator.below` 是当前必须清理的例子：它们已经在 extraction、state projection、canonical builder 和测试里出现，但 registry 中仍有 recognized unsupported 定义。实现时必须统一这类 atom 的支持口径。

### 6. Contract Readiness 与多周期

多周期是 trigger 属性，不是策略族：

- `contextSlots.timeframe` 表示主执行周期或默认周期。
- `trigger.params.timeframe` 表示单个 trigger 的观察周期。
- 多个 trigger 默认 AND。
- contract readiness 检查每个 trigger 的 required params。
- 若 trigger 缺 reference period、threshold、boundary role 等，追问对应 atom slot。
- 若缺主执行周期，追问 `contextSlots.timeframe`，不能生成 `semantic.missing_entry_atom`。

### 7. Projection / Canonical / IR / AST

projection gate 必须消费 per-trigger timeframe：

- 单周期 trigger 沿用全局 timeframe。
- 多周期 trigger 生成多 timeframe series/predicates。
- AND 组合保持所有 trigger 必须满足。
- IR validator 的 timeframe alignment 需要接受明确声明的多周期 predicate。
- AST/script 生成必须保留每个 predicate 的 timeframe。
- 如果某类 atom 当前无法投影，应暴露 projection coverage failure 或 recognized unsupported，不能回退为用户缺语义。

### 8. Clarification 文案

追问必须对应真实 open slot：

- 缺 entry trigger：`请补充入场触发条件。`
- 用户补了 entry trigger 后缺仓位：问仓位。
- trigger 缺 reference period：问均线/指标参数。
- 缺主执行周期：问主执行周期。
- projection 不支持：输出能力边界或内部 projection coverage，不说缺 entry atom。

内部工程词如 `semantic.missing_entry_atom`、`contract.shape`、`projection gate` 不能出现在用户问题里。

## 数据流验收

### 首轮输入

输入：

```text
15min 1h 4h 价格都在 ema20 的上方 买入
```

期望：

- 识别 `15min` 为 `15m`。
- 生成 3 个 `indicator.above` entry trigger。
- 每个 trigger 带 `params.timeframe`。
- 生成 `open_long` action。
- 不生成 `semantic.missing_entry_atom`。
- 若缺 symbol/marketType/position，则追问这些具体 slot。

### 后续补充

上一轮存在 `semantic.missing_entry_atom`，用户输入：

```text
15min k线在 ema20 上方开多
```

期望：

- 作为 entry fragment 被消费。
- 生成 `indicator.above` entry trigger 和 `open_long` action。
- 清理 `semantic.missing_entry_atom`。
- 保留上一轮已有 context/risk/position。
- 后续追问不得再要求“补充入场触发条件”。

### 支持一致性

对每个上线 atom，测试必须证明：

- extractor 可产生该 atom。
- registry supportStatus 与 projection 能力一致。
- contract readiness 能正确打开/关闭 slots。
- projection gate 成功或明确失败。
- 用户文案对应真实原因。

## 测试计划

新增或扩展测试，不按策略族分类，按原子能力和主数据流关口分类：

- extractor unit：
  - `15min 1h 4h 价格都在 EMA20 上方买入`
  - `15min k线在 EMA20 上方开多`
  - `1h RSI14 低于30买入，4h RSI14 高于70卖出`
  - `15m 布林下轨买入，上轨卖出`
  - `15m 通道下沿买，上沿卖`
- open slot fulfillment unit：
  - missing entry + entry fragment
  - missing exit + exit fragment
  - missing position + `单笔 10%`
  - grid density answer 继续保持原行为
- state merge/reducer：
  - 真实 trigger 清理 missing placeholder
  - fragment merge 保留已有 context/risk/position
  - same trigger 去重包含 timeframe
- support alignment：
  - `indicator.above/below` registry、contract、projection 一致
  - unsupported atom 不进入 open slot
- conversation regression：
  - 截图中的首轮和后续补充完整闭环
  - 不再出现内部 reason 或错误的 missing entry 文案
- projection/canonical：
  - 多周期 AND triggers 进入 canonical/IR/AST
  - 每个 predicate 保留 timeframe

## 验收标准

- 首轮探针不会再报 `semantic.missing_entry_atom`。
- 后续补充探针能关闭 entry open slot。
- `semantic.missing_entry_atom` 与真实 entry trigger 不会并存阻塞 readiness。
- 多周期 trigger 在语义 state、canonical、IR、AST 中保真。
- `indicator.above/below` 的支持状态不再分裂。
- 缺什么问什么；不把 projection 或 support 问题伪装成缺用户语义。
- 新测试覆盖首轮输入、续写补槽、placeholder 清理、support 一致性和 projection 保真。
