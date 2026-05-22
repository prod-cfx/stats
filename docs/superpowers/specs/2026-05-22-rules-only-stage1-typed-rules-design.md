# Rules-Only Stage 1: Typed Rules AST

## 背景

Issue #1630 是 rules-only pipeline 的阶段 1。当前 AI Quant 主链路已经有 `semanticPatch.rules[]` 和 rules tree，但语义仍是 rules-first + 五桶兼容：

- `SemanticRule.effects` 仍是裸 `AtomExpr[]`。
- `SemanticState` 仍持久包含 `trigger / action / risk / positionConstraint / orchestration` 五桶。
- Dispatcher 仍可先产五桶，再由合并层重建 rules。
- Readiness、display、canonical spec、脚本生成仍大量消费五桶投影。

阶段 1 不删除这些兼容路径。阶段 1 要先把入口侧策略语义统一迁移到 typed rules，并证明现有 31 条策略能力和脚本代码生成不发生语义漂移。

## 目标

阶段 1 完成 Typed Rules AST：

- 引入 typed `RuleEffects`。
- 将现有五桶 60% 以上策略能力迁移到 typed rules。
- 31 条现有主数据流已支持策略全部跑通。
- 保留 contract / slot 语义，只迁 owner path。
- planner、dispatcher、schema gate、文本对话、策略识别、补槽回答、策略生成、脚本代码生成入口侧都产出或消费 typed rules。
- 旧五桶 patch 只能作为测试对照数据，不能作为生产主路径输入。

阶段 1 结束后，语义上已经是 rules-only：五桶不再有独立语义，只是 typed rules 的兼容投影。

## 非目标

阶段 1 不做以下事项：

- 不删除 `SemanticState.trigger / action / risk / positionConstraint / orchestration`。
- 不删除 `CodegenSemanticPatch` 旧字段类型定义。
- 不删除 `readFlatXxx`。
- 不要求所有核心消费者直接读 rules。
- 不要求 `CanonicalSpecBuilder` 完全不读 flat projection。
- 不删除旧 fixture。
- 不做所有核心消费者直接读 rules 的全面改造。
- 不做旧五桶与 legacy fallback 硬删除。

## Typed Rules AST

先升级 rules 结构：

```ts
interface SemanticRule {
  id: string
  phase: 'entry' | 'exit' | 'gate'
  sideScope: 'long' | 'short' | 'both'
  condition: AtomExpr
  effects: RuleEffects
  evidence?: { text: string }
}

interface RuleEffects {
  actions: AtomExpr[]
  risks: AtomExpr[]
  positions: AtomExpr[]
  orchestration: AtomExpr[]
  programs: AtomExpr[]
}
```

迁移映射固定为：

```text
condition = 原 triggers
effects.actions = 原 action
effects.risks = 原 risk
effects.positions = 原 positionConstraint
effects.orchestration = 原 orchestration
effects.programs = grid / DCA / TWAP / martingale 等执行程序
```

`condition` 就是旧 triggers 的 typed tree 迁移位置。旧 trigger 的 AND / OR / NOT / SEQUENCE 能力必须保持在 `condition` tree 里，不能退化成扁平列表。

## Owner Path 迁移

contract / slot 语义不重写，只迁 owner path：

- 旧 `trigger[0].params.threshold` 迁为 `rules[0].condition...params.threshold`。
- 旧 `action[0].params.orderType` 迁为 `rules[0].effects.actions[0].params.orderType`。
- 旧 `risk[0].params.valuePct` 迁为 `rules[0].effects.risks[0].params.valuePct`。
- 旧 `positionConstraint[0].params.value` 迁为 `rules[0].effects.positions[0].params.value`。
- 旧 `orchestration[0].params.timeframe` 迁为 `rules[0].effects.orchestration[0].params.timeframe`。
- 旧 program/grid 节点迁为 `rules[0].effects.programs[0]`。

缺参追问、补槽回答、readiness open slot 必须能定位到 rule path，不能写 flat owner 作为生产主路径。

## 实施设计

### 1. Schema 与类型

- `SemanticRule.effects` 从 `AtomExpr[]` 改为 typed `RuleEffects`。
- zod schema 校验 typed `RuleEffects` 五个 role 数组。
- schema gate 拒绝旧 patch 字段：`atoms / triggers / actions / risk / position / orchestration`。
- 禁止裸 `effects: AtomExpr[]` 回流。

### 2. Atom Role

- 每个旧 bucket atom 必须有明确 typed rule slot。
- action atom 进入 `effects.actions`。
- risk atom 进入 `effects.risks`。
- position constraint atom 进入 `effects.positions`。
- orchestration scope/gate/data-source/binding atom 进入 `effects.orchestration`。
- grid / DCA / TWAP / martingale / order-program atom 进入 `effects.programs`。
- 不为单个策略新增独立顶层模型。

### 3. Planner

- prompt 明确只输出 `semanticPatch.rules[]`。
- 输出必须使用 typed `effects.actions / risks / positions / orchestration / programs`。
- 禁止输出旧 patch 字段。
- schema reject 后只允许重试合规 typed rules。
- planner 产出的对话说明必须能回指 typed rules path。

### 4. Dispatcher

- `GenericSeedDispatcher` 直接产 typed rules。
- 不允许先产五桶再转换作为生产主路径。
- 旧五桶 dispatcher 输出可保留为测试对照，不能进入生产入口。
- dispatcher 仍遵守 atom registry / contract 驱动，不新增“一个策略一个 if”。

### 5. Merge / Reducer / Edit

- rules 合并按 `id`、`phase`、`sideScope`、`condition`、typed effect role identity 合并。
- 补槽回答写回 `rules[].condition` 或 `rules[].effects.<role>[]`。
- reducer/edit 不得直接修改 flat 五桶作为语义真源。

### 6. Projection 兼容

- 阶段 1 允许保留 `typed rules -> flat projection`。
- 五桶只作为兼容投影，不再有独立语义。
- projection 必须从 typed rules 派生，不能从 flat 反向修复 typed rules。
- provenance 必须能指回 typed rule path。

### 7. 策略生成与脚本代码生成

- 策略生成入口消费 typed rules 派生语义。
- 脚本代码生成入口消费 typed rules / canonical artifacts。
- 不能从旧 patch 字段补执行语义。
- 输出脚本必须和 typed rules、canonical spec 一致。

## 31 条硬回归语料

以下 31 条都是阶段 1 必须跑通的现有能力回归集。它们不是 unsupported 清单，也不拆出阶段 4。

1. 入场：15m k线里面价格在 ema20 ema60 ema144 上方时做多开仓；出场：15m k线里面价格低于 ema20 时平多；止损：5%；仓位：10usdt。
2. 15min k线里面价格在 ema20 ema60 ema144 上方时做多开仓，都位于下方只开空；入场是 boll 下轨开多，上轨开空；币安的 btcusdt 永续合约；风控是亏损 5% 止损。
3. 在 okx 交易所，我想买 btc，3 分钟之内跌 1% 买入，15 分钟之内涨 2% 卖出，单笔用 10% 资金，止损 5%，止盈 10%。
4. OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。
5. 在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈。
6. 在 OKX 现货 ORDI/USDT 上，主周期 1h，使用 10% 固定仓位只做多；入场动作为立即开始时市价买入；出场规则为价格相对前收盘上涨 1% 时卖出，另有相对入场均价下跌 5% 止损卖出、相对入场均价上涨 10% 止盈卖出。
7. OKX 合约 BTCUSDT 1m，使用布林带 5,1。价格触及或突破上轨时做空，价格触及或突破下轨时做多；多单在价格回到中轨时平仓，空单在价格回到中轨时平仓；单笔仓位 10%，止损 1%，止盈 1.5%。
8. 用 BTCUSDT 1m K 线。每次最新 K 线收盘价高于开盘价时尝试开多。如果已有持仓则不再开仓。收盘价低于开盘价时平多。
9. OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各 0.4% 共 10 格、每格 10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行“立即停止并撤销所有未成交订单”。
10. 在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 79200-80200，采用双向网格，每格间距 0.1%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈。
11. 创建一个 OKX BTCUSDT 永续合约策略，使用 15 分钟 K 线。当 EMA7 上穿 EMA21 时开多；当 EMA7 下穿 EMA21 时平多。每次使用账户权益的 10% 开仓，杠杆 1 倍，逐仓不要使用，使用全仓 cross。
12. 15min 布林带下轨买入，上轨卖出。
13. EMA7 上穿 EMA21 时开多；下穿时平多。
14. OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出。
15. 15m 周期，价格区间 79200-80200，采用双向网格。
16. BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。
17. ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入，ETH 日线在 MA120 下方时平仓。
18. BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。
19. BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。
20. ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。
21. SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。
22. BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。
23. ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈。
24. 15min 1h 4h 的价格都在 ema20 的上方买入，15min 跌破 ema20 卖出，在币安交易所 btcusdt 永续合约。
25. OKX 合约 BTCUSDT 15m，收到 webhook 事件 signalId 为 whale_buy 且 secret 已配置时开多，每次 100。
26. BTC/USDT 4h，RSI 跌破 30 开多，RSI 回到 70 平仓，止损 2%。
27. ETH 1h，价格触及布林下轨开多，回到中轨止盈，触及上轨开空。
28. SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断。
29. BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层。
30. ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT。
31. SOL 现货，30 分钟。价格在最近 24 小时区间的 0.3-0.7 分位之间运行时，启用自适应波动率网格；价格突破区间上沿则停止网格并平仓。

## 验收标准

阶段 1 PR 必须满足：

- [ ] Planner 和 dispatcher 不再产旧五桶 patch 作为生产主路径。
- [ ] schema gate 对旧 patch 字段 fail-closed，并返回明确错误。
- [ ] `SemanticRule.effects` 已升级为 typed `RuleEffects`。
- [ ] 每个 old bucket atom 都有明确 rule slot 或 effect role。
- [ ] `condition = 原 triggers`，旧 trigger 的 AND / OR / NOT / SEQUENCE 能力不退化。
- [ ] 缺参数追问能定位到 typed rule path。
- [ ] 补槽回答写回 typed rule path，不写 flat owner 作为生产主路径。
- [ ] 31 条语料全部能从自然语言生成 typed rules。
- [ ] 31 条语料全部能完成 strategy generation。
- [ ] 31 条语料全部能完成 script code generation。
- [ ] 31 条语料无旧 patch 字段进入生产入口。
- [ ] 对话回答中的策略说明能回指 typed rules path，不能来自旧五桶 summary。
- [ ] staging 证据证明策略语义和脚本代码一致。
- [ ] PR body 列出用户最终验收所需 staging 步骤和证据位置。

## Staging 一致性

每条 staging 语料必须记录：

```text
rulesHash
canonicalSpecHash
irHash
astHash
scriptHash
```

一致性规则：

- typed rules 中有的策略语义，canonical spec、IR、AST、script 不能丢。
- script 中出现的执行语义，必须能回溯到 typed rules。
- 对话回答、展示摘要、canonical spec、IR、script 之间不能语义漂移。
- backtest / deploy 若在阶段 1 staging 中执行，必须使用同一 published snapshot truth。
- 任一语料出现语义漂移，阶段 1 不通过。

## 测试策略

最低测试集合：

- typed `RuleEffects` schema 单测。
- planner schema reject 单测：旧 patch 字段、裸 `effects: []`、缺 role 字段。
- dispatcher typed rules 单测：覆盖 31 条语料。
- merge / reducer / edit 单测：补槽 path 写入 `rules[].condition` 或 `rules[].effects.<role>[]`。
- projection 单测：typed rules 投影到五桶且 provenance 指回 rule path。
- 31 条 corpus staging/e2e：自然语言到 typed rules、strategy generation、script code generation、一致性 hash。

## 禁止事项

- 禁止新生产代码依赖旧五桶 patch 作为入口主路径。
- 禁止把 typed `effects` 退回裸数组。
- 禁止为了通过语料新增 legacy 分支。
- 禁止 unsupported 静默降级成默认策略。
- 禁止 display summary、legacy specDesc、flat projection 反向补执行语义。
- 禁止只改后段 builder / compiler / runtime 后宣称阶段 1 完成。

## 决策

阶段 1 采用“入口 typed rules + 兼容投影”方案：

- 入口语义真源是 typed rules。
- 旧五桶只作为 typed rules 的兼容投影。
- 31 条现有能力语料全部跑通。
- 策略和脚本代码必须在 staging 证据中保持一致。
