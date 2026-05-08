# AI Quant Position Lifecycle Atomic Contract Design

日期：2026-05-08
Issue：#984
阶段：Phase 2 - 仓位动作与仓位生命周期

## 背景

Issue #984 要求在 Phase 0/1 已建立的 atomic contract mainflow 上继续扩展 AI Quant 的原子语义能力。Phase 0 已补齐 contract substrate、readiness、runtime/order/state requirements 与覆盖率口径；Phase 1 已落地高频过滤、安全门槛与 `risk.partial_take_profit` 的执行闭环。

Phase 2 的目标不是引入“加仓策略族”“反手策略族”“DCA 策略族”，而是把真实仓位生命周期能力纳入现有原子语义主干：

```text
triggers / actions / risk / position / contextSlots
```

当前仍是测试阶段，产品尚未上线，因此本阶段不承担旧 key、旧 snapshot、旧 display graph 的兼容包袱。设计和实现只面向最新 atomic contract truth。

## 目标

1. 将减仓、加仓、反手、金字塔加仓限制、最大暴露、DCA 计划表达为 atom + contract，而不是策略族模板。
2. 每个新增 supported atom 都完成 semantic state、registry/readiness、canonical spec v2、canonical IR、compiled runtime、backtest fast path、live signal fast path、deploy snapshot 的闭环。
3. 缺关键参数时进入 owner atom 的 open slots；不得静默默认危险交易行为。
4. 仓位增加类动作必须受仓位约束保护，尤其是 pyramiding 或 max exposure。
5. 运行时缺 position/account/state snapshot 时 fail-closed，只允许已有 exit/reduce 风控继续判断，不允许增加暴露。

## 非目标

- 不新增策略族作为核心建模边界。
- 不维护旧 reduce action key、旧 snapshot 或旧 display graph 兼容。
- 不实现 portfolio 维度组合风控；该能力留给后续 orchestration phase。
- 不实现动态自适应 DCA、跨标的 DCA 或 portfolio-level DCA。
- 不让前端 display graph 参与 deploy truth payload。

## 方案比较

### 推荐方案：Contract-first Phase 2 升级

继续以 `SemanticState` 为唯一事实来源，在 `actions` 与 `position` 域扩展仓位生命周期 atom，并通过 contract/readiness/canonical/runtime 闭环发布。

优点：

- 不破坏 Phase 0/1 建立的原子语义主线。
- 每个 atom 都能按统一方式声明 effects、requirements 和 open slots。
- 后续多腿、组合风控和 orchestration 可复用这些 position/action effects。

代价：

- 需要同步覆盖 registry、canonical、runtime、backtest、live signal 和测试。

### 备选方案：只增强自然语言 extractor

只识别“加仓”“反手”“DCA”等表达，不同步执行链路。

优点：短期改动少。

缺点：会形成“语义识别正确但不可执行”的伪支持，不满足 Issue #984 的执行闭环要求。

### 备选方案：策略族模板

为加仓、反手、DCA 各自建立策略族模板。

优点：单个样例实现快。

缺点：违背 atomic mainflow，后续每种仓位生命周期组合都会回到 ad hoc 分支。

## 语义边界

Phase 2 atom 分布如下：

- `actions`
  - `action.reduce_position`
  - `action.add_position`
  - `action.reverse_position`
- `position`
  - `position.pyramiding_limit`
  - `position.max_exposure_pct`
  - `position.dca_schedule`
- `risk`
  - 继续承载止损、止盈、强制退出、分批止盈等风控。
  - `risk.partial_take_profit` 可以编译为 reduce exposure effect，但不拥有独立减仓执行模型。
- `triggers`
  - 继续承载“盈利后”“回撤后”“再次确认”“每跌 N%”“每隔 N 根 K 线”等触发条件。

仓位动作不承载触发条件，触发条件不承载仓位效果。两者通过 canonical rule/action binding 关联。

## Contract 模型

Phase 2 继续加厚现有 `SemanticAtomContract`：

```ts
SemanticAtomContract {
  id
  kind: 'trigger' | 'action' | 'risk' | 'position' | 'context'
  capabilities
  requires
  params
  effects
  runtimeRequirements
  stateRequirements
  orderRequirements
  openSlots
}
```

Phase 2 atom 必须声明：

- `effects`：例如 `reduce_exposure`、`increase_exposure`、`close_position`、`open_opposite_side`、`block_exposure_increase`。
- `orderRequirements`：例如 market order、reduce-only、close-before-open、no-exposure-increase。
- `stateRequirements`：例如 pyramiding layer count、DCA fired count、reverse execution state。
- `runtimeRequirements`：例如 current position snapshot、account/symbol exposure、bar/price feed。
- `openSlots`：例如 reduce value、max layers、max exposure、same-bar policy、DCA capital cap。

## Atom 执行语义

### `action.reduce_position`

表达减少当前仓位暴露。

必需参数：

- `sideScope`：long、short 或 both。
- `reduceBasis`：ratio、quote 或 base。
- `reduceValue`：减仓比例、quote 金额或 base 数量。

执行语义：

- effect 为 `reduce_exposure`。
- order requirement 必须包含 reduce-only 或等价的 no-exposure-increase 约束。
- runtime 不得因 reduce 超过当前仓位而反向开仓；若 reduce 数量超过当前仓位，则截断到当前可减仓数量。

### `action.add_position`

表达在已有同向仓位基础上增加暴露。

必需参数：

- `sideScope`。
- `sizing` 或 layer sizing 来源。
- 至少绑定 `position.pyramiding_limit` 或 `position.max_exposure_pct`。

执行语义：

- effect 为 `increase_exposure`。
- 没有 pyramiding 或 max exposure contract 时不得 deploy。
- runtime 必须读取当前仓位和相关 state key，确认未超过 layer/exposure 限制后才执行。

### `action.reverse_position`

表达反手交易，固定拆成两阶段：

```text
close current side -> open opposite side
```

必需参数：

- `fromSide` 与 `toSide`。
- `sameBarPolicy`：是否允许同一根 K 线内先平再反向开仓。
- `sizingSource`：沿用原仓、固定 sizing、或重新指定 sizing。

执行语义：

- order requirements 必须包含 close-before-open。
- runtime 不能把 close 和 open 合并为一个模糊动作。
- 如果 close 阶段失败或状态未知，不得执行 open opposite side。

### `position.pyramiding_limit`

表达加仓层数与每层 sizing 限制。

必需参数：

- `maxLayers`。
- `layerSizing`。
- 可选 `totalExposureCapPct`；若缺失但存在 `position.max_exposure_pct` 可由后者约束。

执行语义：

- 该 atom 不是交易动作，而是 `action.add_position` 的执行约束。
- runtime 维护 layer count；超过限制时 block add。
- block add 不阻止 exit、reduce 或风险退出。

### `position.max_exposure_pct`

表达最大暴露比例。

Phase 2 支持 scope：

- current symbol
- current strategy

不支持 scope：

- account
- portfolio
- cross-symbol
- subStrategy

这些 scope 留给后续 orchestration / portfolio risk。

必需参数：

- `scope`。
- `valuePct`。
- `basis`：equity、allocated capital 或 strategy capital。

执行语义：

- 作为 `add_position`、`dca_schedule` 和可选 open action 的 exposure ceiling。
- scope 不明确时进入 open slot，不能默认全账户或全策略。

### `position.dca_schedule`

表达 DCA / 补仓计划。

Phase 2 支持的可执行子集：

- 固定最大次数。
- 固定每次 sizing 或比例 sizing。
- 固定 price interval、time interval 或 signal-driven trigger。
- 明确总资金上限。
- 明确退出或停止规则。

必需参数：

- `maxCount`。
- `capitalCap`。
- `perOrderSizing`。
- `triggerMode`。
- `exitRule` 或 `stopRule`。

执行语义：

- runtime 维护 DCA fired count。
- 达到 max count 或 capital cap 后 block new DCA orders。
- 缺退出/停止规则时不得 deploy。
- 动态自适应 DCA、跨标的 DCA 与 portfolio-level DCA 继续 recognized_unsupported。

## 数据流

Phase 2 只面向最新 atomic contract mainflow：

```text
SemanticState
  -> registry/support classifier
  -> contract readiness
  -> canonical spec v2
  -> canonical IR
  -> compiled script/runtime
  -> backtest fast path
  -> live signal fast path
  -> deploy snapshot
```

要求：

- 自然语言抽取写入 `SemanticState.actions` 与 `SemanticState.position`。
- registry 只有在执行链路完整时才标记 `supported_executable`。
- readiness 检查参数、order capability、runtime position/account state、state key 与 exposure guard。
- canonical/IR 表达 action effects 和 position constraints，不使用策略族名称作为分支 authority。
- compiled runtime 和 backtest/live signal 使用同一套 helper 与 state key。
- deploy 只保存 compiled snapshot truth。

## Open Slots 与 Fail-Closed

所有缺口挂回 owner atom 的 `openSlots`。

典型 open slots：

- `action.reduce_position.value`：减仓多少，例如 30%、100 USDT、0.01 BTC。
- `action.add_position.constraint`：最大加仓限制是什么，例如最多 3 层，或总仓位不超过策略资金 30%。
- `action.add_position.layer_sizing`：每次加仓多少。
- `action.reverse_position.same_bar_policy`：是否允许同一根 K 线内先平再反向开仓。
- `action.reverse_position.sizing_source`：反手后的仓位大小如何确定。
- `position.pyramiding_limit.max_layers`：最多加仓几层。
- `position.max_exposure_pct.scope`：最大暴露按当前品种还是当前策略计算。
- `position.dca_schedule.max_count`：最多执行几次 DCA。
- `position.dca_schedule.capital_cap`：DCA 总资金上限。
- `position.dca_schedule.exit_rule`：何时停止或退出 DCA 仓位。

Fail-closed 规则：

- `add_position` 缺 pyramiding 与 max exposure：不可部署。
- `dca_schedule` 缺最大次数、资金上限、每次 sizing 或退出规则：不可部署。
- `reverse_position` 缺动作顺序、same-bar 策略或 sizing 来源：不可部署。
- runtime 读不到当前 position snapshot 或 state key：不执行增加暴露、反手或 DCA。
- 混合 supported 与 unsupported atom：整条策略不可标记为 executable。

## 测试策略

### Golden Corpus

新增或扩展代表用例：

- `盈利 5% 后减仓 30%。`
- `BTC 回踩 MA20 不破后加仓，最多加仓 3 次。`
- `盈利超过 10% 后每次信号确认加仓 20%，总仓位不超过策略资金 40%。`
- `跌破 MA50 平多并反手做空，反手仓位沿用原仓位。`
- `每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT，跌破前低停止。`
- `回撤补仓但没说最多补几次。`
- `反手但没说是否同一根 K 线内开反向仓。`

每个 case 标注路由：

- `supported_executable`
- `supported_requires_slot`
- `recognized_unsupported`
- `unsupported_unknown`

### Unit / Integration Coverage

需要覆盖：

- 语义抽取：中文真实表达进入正确 atom 域。
- registry/readiness：路由与 open slot owner 正确。
- canonical/IR：effects、stateRequirements、orderRequirements 被保留。
- compiled runtime：reduce-only、layer count、max exposure、DCA count、reverse close-before-open。
- backtest/live parity：同一 compiled artifact 产出一致 decision。
- deploy guard：只有 readiness 完整的 snapshot 能部署。
- negative cases：缺限制的加仓、缺退出规则的 DCA、缺 sizing 的反手、动态自适应 DCA 均 fail-closed。

## 验收标准

- `action.reduce_position`、`action.add_position`、`action.reverse_position` 有明确 effects 与 order requirements。
- `action.add_position` 必须受 `position.pyramiding_limit` 或 `position.max_exposure_pct` 约束。
- `action.reverse_position` 必须明确 close + open 顺序、same-bar 策略和 sizing 来源。
- `position.dca_schedule` 必须有最大次数、最大资金、每次 sizing、退出或停止规则。
- Phase 2 代表场景有 golden corpus、canonical IR、compiled runtime、backtest/live parity 测试。
- display graph 不参与 deploy truth payload。
- 不引入策略族模板。
- 不做旧兼容。

## 风险与回滚点

最大风险是把仓位增加类动作提前标为 supported，但 runtime 未能正确读取当前仓位、层数或暴露限制。

回滚策略：

- 每个 atom 独立升级 registry support status。
- 若某个 atom 的 runtime parity 不完整，保持 `recognized_unsupported` 或 `supported_requires_slot`。
- 若 DCA 可执行子集不完整，只保留 corpus 负例与 open slots，不发布 supported executable。
