# 上线级通用 Atom Contract 覆盖包设计

日期：2026-05-05

## 背景

#960 和 #963 已经把 AI Quant 主流程推进到 contract-first：策略 readiness 逐步转向 semantic trigger/action/risk/position/contextSlots，而不是依赖 family、checklist 或 compileability。当前剩余问题不是单个布林带、MACD 或网格策略缺补丁，而是上线公测前缺少一套系统化的 atom coverage matrix 和 golden corpus。

用户在公测中会用自然语言描述 MA、EMA、RSI、MACD、布林带、通道、突破、均值回归、网格、DCA、趋势跟随、震荡策略等。它们不应该成为主流程里的策略族。它们应该被压成通用 atom 的组合，并由 contract 明确哪些能执行、哪些缺参数、哪些目前公测不支持。

## 目标

建立上线级通用 atom contract 覆盖包，覆盖大部分主流量化策略表达的共享原子语义：

- trigger：价格突破/跌破、区间位置、指标上下穿、阈值比较、指标边界、趋势/震荡状态、成交量/波动率条件、时间窗口。
- action：开多、开空、平多、平空、双向、加仓、减仓、反手、暂停/不交易。
- risk：止损、止盈、移动止损、最大回撤、最大亏损、冷却时间、最大持仓数。
- position：固定金额、固定比例、固定张数、杠杆、逐仓/全仓、单向/对冲。
- contextSlots/openSlots：交易所、标的、周期、现货/合约、方向、仓位大小、订单类型、默认值来源。

这次改造扩大的是理解层覆盖面，不扩执行层主干。当前 canonical/IR/compiler/runtime 能稳定支撑的 atom 才允许进入生成；不能执行的主流表达必须被识别为 recognized unsupported，并给用户一个最接近、可测试的替代策略。

## 非目标

- 不把市面策略族逐个写成模板。
- 不让 family 决定 readiness。
- 不让 checklist 决定 readiness。
- 不用模糊兜底承接主流策略表达。
- 不在本轮扩展复杂 DCA、成交量策略、ATR 动态止损、多档分批止盈、复杂加仓反手等执行层能力。
- 不依赖前端按钮完成确认；当前 AI 对话是纯语言入口。

## 核心原则

主流程只认 atom、contract、contextSlots、openSlots、supportStatus 和 projection gate。

每个 atom 必须有明确 supportStatus：

- `supported_executable`：当前能稳定投影到 canonical/IR/compiler/runtime，可以生成、回测、部署。
- `supported_requires_slot`：能力支持，但缺少必要参数，继续走现有 openSlots 追问。
- `recognized_unsupported`：系统听懂了，这是主流策略能力，但公测暂不支持执行，进入 unsupported fallback。
- `unsupported_unknown`：没有落到可信 atom，不能生成，要求用户换一种自然语言策略描述。

## Coverage Matrix

### Trigger Atom

应覆盖：

- 价格条件：突破、跌破、上穿、下穿、回踩、区间上沿/下沿/中位。
- 指标条件：MA、EMA、RSI、MACD、布林带、通道等作为 operand，不作为策略族。
- 指标交叉：指标 vs 指标、价格 vs 指标、指标 vs 阈值。
- 指标边界：触碰上轨/下轨/中轨、突破边界、回归边界。
- 成交量条件：放量、缩量、成交量阈值、成交量均线比较。
- 波动率条件：ATR 阈值、波动率状态、波动率过滤。
- 时间窗口：N 根 K 线内、连续 N 次、收盘确认、交易时段。
- 市场状态：趋势、震荡、高波动、低波动。

当前可执行候选：

- OHLC 价格比较、突破和上下穿。
- SMA/EMA/RSI/MACD 常见阈值与交叉。
- 布林带上下中轨与连续在带外。
- 通道最高/最低突破。
- 区间位置。
- 趋势/震荡/波动状态 gate。
- 收盘确认和 cooldown 相关的 bar-close 执行模型。

先标 recognized unsupported：

- 成交量放大/缩量和成交量均线过滤。
- ATR 阈值和 ATR 作为入场过滤。
- 多时间周期复杂确认。
- 交易时段限制。
- 复杂形态和背离。

### Action Atom

应覆盖：

- 开多、开空、平多、平空。
- 双向。
- 加仓、减仓、反手。
- 暂停交易、不交易、仅观察。

当前可执行候选：

- `open_long`
- `open_short`
- `close_long`
- `close_short`
- `reduce_long`
- `reduce_short`
- `block_new_entry` / halt 类 guard 作为风险或 gate effect。

先标 recognized unsupported：

- 用户级复杂加仓。
- 反手。
- 多层 scale in / scale out。
- 无明确风险触发语义的暂停交易。

### Risk Atom

应覆盖：

- 固定止损、固定止盈。
- 移动止损。
- 最大回撤、最大单笔亏损。
- 冷却时间。
- 最大持仓数。
- 分批止盈 / 分批减仓。

当前可执行候选：

- 固定百分比止损。
- 固定百分比止盈。
- trailing stop percent，但必须有可靠 trailing anchor 与 projection 证据。
- 最大单笔亏损 / 最大回撤中已能稳定投影的部分。
- cooldown bars。
- 表达式 guard。
- 减仓类单档 action。

先标 recognized unsupported：

- ATR 止损。
- 多档分批止盈。
- 最大持仓数按“仓位数量 N”表达的场景。
- 条件化组合风控。
- 时间止损中缺少明确执行语义的场景。

### Position Atom

应覆盖：

- 固定金额。
- 固定比例。
- 固定张数/币数。
- 杠杆。
- 逐仓/全仓。
- 单向/对冲。

当前可执行候选：

- 固定比例。
- 固定 quote 金额。
- 固定 base 数量。
- long-only、short-only、long-short position mode。

先标 recognized unsupported 或只记录：

- 用户显式杠杆策略声明。
- 逐仓/全仓自由切换。
- 对冲模式自由声明。
- DCA schedule。
- 复杂网格资金模型。

### Context / OpenSlot Atom

应覆盖：

- 交易所。
- 标的。
- 周期。
- 现货/合约。
- 方向。
- 仓位大小。
- 订单类型。
- 默认值来源：用户显式、系统默认、上下文推断。

contextSlots 和 openSlots 只处理“可支持但缺信息”的策略。不支持能力不能伪装成 openSlot。

## 主流程

用户消息进入后按以下流程处理：

1. Extract：把自然语言提取成 trigger/action/risk/position/context atom。
2. Classify：每个 atom 通过 registry 得到 supportStatus。
3. Route：
   - 全部为 `supported_executable`：进入 projection gate。
   - 存在 `supported_requires_slot`：继续现有 openSlots 追问。
   - 存在 `recognized_unsupported`：进入 `pendingUnsupportedFallback`。
   - 只有 `unsupported_unknown` 或无法形成核心 atom：要求用户换一种策略描述。
4. Confirm：projection gate 通过后才允许确认生成。
5. Generate：生成 canonical/IR/AST/script，并由已有 publication/backtest gate 校验。

## 组合策略支持规则

复杂策略本质上是多个 atom 的组合，而不是新的策略族。系统必须允许用户把多个 trigger/action/risk/position/context atom 组合成一条策略，例如：

> MACD 金叉 + 价格在 MA50 上方 + RSI 未超买时开多，跌破 MA20 或 RSI 超买时平仓，5% 止损，10% 止盈，冷却 3 根 K 线。

组合策略按整体验证：

- 组合中的所有 active atom 都是 `supported_executable`，或是 `supported_requires_slot` 且 openSlots 可关闭，整条策略才允许进入 projection gate。
- 组合中任意 active atom 是 `recognized_unsupported`，整条策略进入 `pendingUnsupportedFallback`。
- 组合中任意 active atom 是 `unsupported_unknown`，整条策略不生成，要求用户换一种策略描述。
- 不允许把支持 atom 和不支持 atom 混合后做“部分生成”，因为这会改变用户原始策略含义。
- fallback replacement 必须替换整条策略为一个最接近的可测试策略，而不是只静默删除不支持 atom。

这条规则避免“看起来支持复杂策略，实际只执行了一部分”的公测风险。

## Unsupported Fallback

`recognized_unsupported` 是产品化能力边界，不是兜底失败。

当用户表达包含当前公测不可执行的主流能力时，系统回复必须包含：

- 识别到的能力名称。
- 公测暂不支持的清晰原因。
- 一个最接近的可测试策略。
- 是否改用该策略继续的纯语言确认问题。

示例：

> 我听懂了，你要的是 ATR 移动止损。  
> 但 ATR 动态止损当前公测暂未支持生成和回测。  
> 可以先测试这个相近策略：BTCUSDT 15m，价格突破 MA50 开多，跌破 MA20 平仓，5% 止损，10% 止盈，单笔 10% 仓位。  
> 它保留了趋势入场和风险控制，但把动态止损替换为当前已支持的固定止损/止盈。是否改用这个策略继续？

`pendingUnsupportedFallback` 必须与 openSlots 分流：

- 不继续追问 unsupported atom 的参数。
- 不进入 canonical/IR/AST/script。
- 不污染现有 readiness。
- 用户确认后，把推荐策略作为新的 semantic patch 重新进入主流程。

确认话术需要覆盖自然语言：

- 接受：`确认`、`可以`、`好`、`就这个`、`先测试这个`、`确认，可以等等`、`可以，继续`。
- 拒绝：`不要`、`算了`、`等支持再说`、`不改`。
- 修改：`可以，但周期改成 1h`、`用这个，不过仓位 5%`。
- 不清楚：继续问一句，不推进生成。

## Projection Gate

生成前必须 fail closed：

- active atom 必须有可投影 contract。
- required openSlots 必须全部关闭。
- 不允许存在 `recognized_unsupported`。
- 不允许存在 `unsupported_unknown`。
- canonical projection 不能丢失语义。
- compileability 只能作为投影结果校验，不能替代 semantic readiness。
- family 和 checklist 不能作为 readiness 依据。

这样执行层不改也不会导致后续跑不通。不支持能力根本不会进入执行层。

## 后端范围

后端改造集中在 `apps/quantify/src/modules/llm-strategy-codegen`：

- 新增或整理 atom registry，集中声明 atom category、required/defaultable params、openSlot 规则、supportStatus、projection、unsupported reason、fallback replacement。
- seed extractor / seed state builder 从问题驱动补丁转向 coverage matrix 驱动。
- readiness 只消费 atom contract、contextSlots、openSlots 和 supportStatus。
- conversation flow 增加 `pendingUnsupportedFallback` 状态。
- conversation continue 阶段识别纯语言接受/拒绝/修改替代策略。
- projection gate 在 confirmGenerate 前强制检查。
- 兼容旧数据中的 family 字段，但只作为展示或历史兼容信息，不参与 readiness。

## 前端范围

当前 AI 对话是纯语言体验，不新增按钮依赖。

前端需要正确展示：

- recognized unsupported 的用户可读说明。
- 推荐的一个可测试替代策略。
- 等待用户确认的普通文本消息。
- 用户确认后继续现有对话状态。

如果现有前端只是渲染后端 message 和 clarification items，则优先复用现有结构。只有当现有 DTO 无法承载 unsupported fallback 状态时，才扩展 API contract。

前端不负责判断策略是否支持，不负责生成 fallback 策略，不负责 readiness。

## 数据库 / Prisma 范围

需要检查现有 codegen session / conversation 持久化字段是否能保存：

- semantic state 中 atom supportStatus。
- pendingUnsupportedFallback 状态。
- unsupported reason。
- recommended fallback strategy 文本或 structured patch。
- 用户对 fallback 的接受/拒绝/修改结果。

优先复用现有 JSON 字段保存 conversation state 和 semantic state，避免不必要 schema 扩张。

如果现有 Prisma schema 无法可靠恢复 pending fallback，会新增最小字段或 JSON 子结构，并提供迁移：

- 不创建根目录 `.env`。
- 不提交 `.env.*.local`。
- Prisma schema 修改后按项目规范执行 `dx db format`、`dx db generate`、必要时创建 migration。

## API Contract 范围

若响应 DTO 需要表达 unsupported fallback，则扩展 quantify OpenAPI contract：

- fallback 状态。
- unsupported atom display names。
- recommended strategy text。
- pending confirmation metadata。

更新后需要构建 contracts，确保前端消费类型同步。

## Golden Corpus

新增 50-100 条真实用户表达，测试只断言 atom/contract/openSlots/supportStatus，不断言策略族。

覆盖：

- 均线交叉。
- RSI 超买超卖。
- MACD 金叉死叉。
- 布林带均值回归。
- 通道突破。
- 放量突破。
- ATR 止损。
- DCA。
- 网格。
- 趋势跟随。
- 震荡反转。
- 分批止盈。
- 加仓、减仓、反手。
- 杠杆、逐仓、全仓、对冲。
- 缺交易所、标的、周期、仓位、订单类型。
- unsupported fallback 接受、拒绝、修改话术。

## 验证计划

后端：

- atom registry 单测。
- seed extractor / seed state builder golden corpus 单测。
- readiness 分流单测。
- 组合策略整体验证单测，覆盖支持组合、缺参数组合、recognized unsupported 组合和 unknown 组合。
- unsupported fallback 状态机单测。
- projection gate 单测。
- conversation service 回归测试，确保 family/checklist/fallback 不决定 readiness。

前端：

- API adapter / store 单测，确保 unsupported fallback 可以显示。
- 纯语言确认后继续原会话。

数据库 / Prisma：

- 如果改 schema，执行 `dx db format`、`dx db generate`，并创建迁移。
- session 恢复测试覆盖 pendingUnsupportedFallback。

集成：

- 代表性 supported 策略仍能走到 confirm/generate。
- 代表性 unsupported 策略不会进入 canonical/IR/AST/script。
- fallback strategy 经用户确认后重新进入主流程。

## 风险与控制

- 风险：atom registry 过宽导致误放行。
  - 控制：只有有 projection 证据的 atom 才能标 executable。
- 风险：unsupported fallback 被误当 openSlot。
  - 控制：状态机分流，recognized unsupported 直接阻断。
- 风险：前端无法表达新状态。
  - 控制：优先复用 message；必要时最小 DTO 扩展。
- 风险：旧数据 family 字段影响 readiness。
  - 控制：family 只保留兼容读路径，不参与主流程决策。
- 风险：Prisma schema 扩张带来迁移成本。
  - 控制：优先复用现有 JSON 状态；只有恢复语义不可靠时才迁移。

## 交付顺序

1. 建 atom registry 与 supportStatus 类型。
2. 接入 extractor / seed builder。
3. 改 readiness 和 projection gate。
4. 加组合策略整体验证。
5. 加 unsupported fallback 状态机。
6. 检查前端 DTO/adapter 展示路径。
7. 检查 Prisma 持久化；必要时补 schema 和 migration。
8. 加 golden corpus 和回归测试。
9. 跑增量 lint/build/test/contracts。
