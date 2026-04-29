# AI Quant Contract-Based Grid Runtime Design

日期：2026-04-29

状态：Draft for user review

范围：用户通过 AI Quant 对话新建真实网格策略；语义、CanonicalSpecV2、IR、AST、部署分流、OKX demo 现货/合约网格运行时。

---

## 1. 背景

当前对话生成策略的主链路是：

```text
用户对话
-> SemanticState 原子语义
-> normalized intent
-> CanonicalSpecV2
-> digest / confirm
-> IR
-> AST
-> compiled artifact / published snapshot
-> deploy
-> runtime
```

现有 `grid-range` 更接近单仓区间低买高卖，不是真实交易所网格机器人。本设计不改策略广场，也不把网格做成模板分支；目标是让用户通过对话创建的网格策略按市面量化平台的真实网格方式运行。

---

## 2. 目标

1. 支持对话创建真实网格策略，并保持现有主链路顺序不变。
2. 使用 `triggers / actions / risk / position / contextSlots` 的原子语义结构表达网格，不引入策略族。
3. 引入 atom contract，让编译器根据 contract 的能力、依赖和效果组合生成执行结构，而不是根据字符串 key 或 family 分支。
4. CanonicalSpecV2、IR、AST 能表达持续订单程序；IR 必须生成 `levelSets + orderPrograms`，AST 必须保留 `orderPrograms`。
5. 部署后按 AST 分流：普通 decision program 继续走 signal runtime；order program 走新的 grid runtime。
6. 第一版支持 OKX demo：
   - spot grid
   - perp long grid
   - perp short grid
   - perp neutral grid
7. Grid runtime 支持固定区间、固定格数或固定间距、固定每格资金、limit GTC、成交后挂反向单、订单同步、幂等恢复、越界停止和撤单。

---

## 3. 非目标

1. 不改策略广场模板，不处理现有 `grid-range` 命名或展示。
2. 不新增 `families` 语义主干；`SemanticState.families` 不参与本设计。
3. 不按 `grid.*`、策略族、模板 ID 或字符串 key 做编译主判断。
4. 不把真实网格降级成 `OPEN_LONG / CLOSE_LONG` 的普通单次信号。
5. 不让 `TradingSignal` / `SignalExecutor` 承担网格订单状态机职责。
6. 第一版不支持动态移动网格、自适应波动网格、多交易所、多标的套利或 UI 完整详情页；只保留后端可查询状态 API。

---

## 4. 核心约束

真实网格的语义来源只能是现有大原子结构：

- `contextSlots`：交易上下文，如 exchange、symbol、marketType、timeframe。
- `triggers`：价格层级触达、价格在区间内、价格越界、可选门控条件。
- `actions`：维护限价订单程序、成交后挂反向单、停止、撤单。
- `position`：每格资金、总预算、long/short/long_short、neutral exposure、杠杆、保证金模式。
- `risk`：越界停止、止盈止损、最大回撤、异常订单保护。

这些原子不靠固定 key 被识别，而是携带 contract。历史 key 如果必须保留，只能作为兼容 id、显示 id 或迁移辅助，不得作为编译主判断。

---

## 5. Atom Contract

新增 contract 层作为原子语义的结构化能力描述。示意类型：

```ts
interface SemanticAtomContract {
  id: string
  kind: 'trigger' | 'action' | 'risk' | 'position' | 'context'
  capabilities: SemanticCapability[]
  requires: SemanticRequirement[]
  params: Record<string, unknown>
  effects?: SemanticEffect[]
}

interface SemanticCapability {
  domain: 'market' | 'price' | 'order_program' | 'capital' | 'exposure' | 'margin' | 'guard'
  verb: string
  object: string
  shape: Record<string, unknown>
}
```

Contract 关注能力和依赖，不关注策略族。例如真实网格需要的组合能力包括：

- context contract 提供 market capability：交易所、市场类型、标的、周期。
- trigger contract 提供 price capability：固定层级、区间激活、边界突破。
- action contract 提供 order program capability：维护限价阶梯、成交后回收、撤单范围。
- position contract 提供 capital / exposure / margin capability：每单资金、总预算、long/short/neutral 暴露、杠杆。
- risk contract 提供 guard capability：边界突破停止、停止时撤单。

编译器根据 contract 满足关系判断能否生成持续订单程序：

```text
market(symbol + venue)
+ price(level_set + range_activation)
+ order_program(limit_ladder + recycle_on_fill)
+ capital(budget)
+ exposure(policy)
=> IR.levelSets + IR.orderPrograms
```

缺失任何 required capability 时，不允许降级成普通信号；应产生 open slot 或 compileability reason。

---

## 6. 语义到 CanonicalSpecV2

SemanticState 仍是唯一生产语义来源。对话提取或编辑阶段只产生/更新原子和 contract：

- 缺区间时追问 lower / upper。
- 缺格数或间距时追问 gridCount 或 spacing。
- 缺资金时追问 per-grid budget 或 total budget。
- 合约缺方向时追问 long、short 或 neutral。
- 合约缺杠杆/保证金模式时追问或使用项目定义的安全默认值。

CanonicalSpecV2 不新增策略族入口。它应承载一组 contract-normalized atoms，并能把可执行的持续订单语义表达为结构化 program intent。普通 entry/exit rule 继续表达一次性决策；满足 order program contract 的 atom 组合表达持续订单程序。

确认页和摘要展示应从 contract-normalized CanonicalSpecV2 生成，向用户说明：

- 交易所、标的和市场类型。
- 固定区间和网格数量/间距。
- 每格资金和总预算。
- 现货或合约模式；合约 long、short 或 neutral。
- 越界停止和撤单策略。

---

## 7. IR / AST 扩展

IR 编译器新增 contract resolver，输入 CanonicalSpecV2 的 contract-normalized atoms，输出：

- `signalCatalog.levelSets`：固定区间层级，支持等差或等比。
- `signalCatalog.predicates`：区间内激活、越界停止、可选门控。
- `orderPrograms`：持续限价订单程序，包含 side policy、pairing policy、quantity policy、recycle policy、cancel scope。
- `portfolio`：多层持仓和中性 exposure 的资金/仓位约束，不能使用普通策略默认的 `maxConcurrentPositions: 1` 和 `allowPyramiding: false`。
- `executionPolicy`：`orderTypeDefault: limit`、`timeInForce: gtc`、允许部分成交。

AST 编译器必须保留 `orderPrograms`，并在 `executionModel` 中保留 grid runtime 所需的信息。AST 不得把 order program 展开成普通 decision program。

发布一致性检查新增 contract invariant：

1. SemanticState 的 contract capability、params、requirements 必须能在 CanonicalSpecV2 中找到对应结构。
2. CanonicalSpecV2 的持续订单语义必须在 IR 的 `levelSets / orderPrograms` 中体现。
3. AST 必须保留与 IR 等价的 `orderPrograms`。
4. 如果任何阶段把持续订单语义降级成普通 `BUY / SELL / CLOSE_*` 信号，发布失败。

---

## 8. 部署分流

部署时读取 published snapshot 的 AST：

- 仅有 `decisionPrograms` 且无 `orderPrograms`：继续走现有 signal runtime。
- 存在 `orderPrograms`：创建 `GridRuntimeInstance`，交给 grid runtime。
- 同一策略未来若同时有 gate predicate 和 order program，gate 只控制 grid runtime 的 active 状态，不转成普通信号。

普通 signal runtime 不需要理解网格，也不绕过它自己的单仓保护。Grid runtime 不使用普通 signal 的单仓入场限制，而是用自己的资金预算、层级状态、订单归因和 exposure 规则控制风险。

---

## 9. Grid Runtime 数据模型

新增 `grid-runtime` 模块，按 Controller -> Service -> Repository 分层。

核心持久化模型：

- `GridRuntimeInstance`
  - 绑定 `strategyInstanceId`、`publishedSnapshotId`、`userId`、`exchangeAccountId`、symbol、marketType、mode。
  - 保存 contract-derived config snapshot、状态、启动/停止原因、最后同步时间。
- `GridLevel`
  - 价格层级，包含 index、price、side role、base/quote size、状态。
- `GridOrder`
  - 实际交易所订单，包含 levelId、clientOrderId、exchangeOrderId、side、price、amount、filled、status、pairedOrderId、raw。
- `GridFill`
  - 成交明细，用于幂等识别成交、收益计算和反向补单。
- `GridRuntimeEvent`
  - 状态机事件日志，用于恢复和排障。

状态机：

```text
CREATED -> INITIALIZING -> RUNNING -> PAUSING -> PAUSED -> STOPPING -> STOPPED
```

异常态：

```text
RECONCILE_REQUIRED / ERROR / TERMINATED
```

订单状态：

```text
PLANNED -> SUBMITTING -> OPEN -> PARTIALLY_FILLED -> FILLED
        -> CANCELING -> CANCELED -> REJECTED -> STALE
```

---

## 10. 运行逻辑

1. 部署时从 AST `orderPrograms` 解析执行合同，创建 `GridRuntimeInstance` 和 `GridLevel`。
2. 初始化根据当前价格和模式决定初始挂单：
   - spot：当前价下方挂买，上方根据持仓或预算挂卖；无底仓时只挂买或按配置先建初始仓。
   - perp long：下方开多买单，上方平多卖单。
   - perp short：上方开空卖单，下方平空买单。
   - perp neutral：同时维护 long/short 网格，要求 OKX 账户处于兼容的持仓模式；不满足则阻止启动并给出明确错误。
3. Scheduler 周期同步 OKX open / closed orders，更新 `GridOrder` 和 `GridFill`。
4. 某一格成交后，按 pairing policy 挂相邻反向单。
5. 价格越界、用户停止或订单不一致时进入停止或 reconcile，必要时撤销本 bot 的 open orders。
6. 重启后通过 `clientOrderId`、本地订单表和 OKX open / closed orders 恢复状态。

关键保护：

- `clientOrderId` 必须包含 grid instance、level、side、attempt，用于幂等和归因。
- 只管理本 bot 创建的订单，不触碰用户手工订单。
- 下单前先持久化 intent，再调用 OKX，ACK 后回写；失败进入可恢复状态。
- 部分成交不静默当作完全成交，必须按 filled quantity 和剩余量推进状态。

---

## 11. OKX 能力要求

交易层需要支持或补齐：

- limit GTC 下单。
- open orders 查询。
- closed / filled orders 查询。
- clientOrderId 归因。
- cancel order。
- spot 数量、价格、tick size、lot size 校验。
- perp contract size 换算。
- perp `tdMode`、`posSide`、`reduceOnly`、long/short/neutral 需要的持仓模式校验。

Grid runtime 通过现有 `TradingService` 和 OKX client 访问交易所；如 `TradingService` 接口不足，应扩展交易抽象，而不是在 grid runtime 中直接访问 OKX 私有接口。

---

## 12. API

第一版只提供后端状态查询和控制 API，不做完整前端详情页：

```text
GET  /grid-runtime/instances/:id
GET  /grid-runtime/instances/:id/orders
GET  /grid-runtime/instances/:id/fills
POST /grid-runtime/instances/:id/pause
POST /grid-runtime/instances/:id/resume
POST /grid-runtime/instances/:id/stop
POST /grid-runtime/instances/:id/reconcile
```

API 只允许访问当前用户自己的 grid runtime instance。

---

## 13. 测试

语义和编译：

1. 自然语言创建 spot grid、perp long grid、perp short grid、perp neutral grid，生成 contract atoms。
2. 缺区间、格数/间距、资金、合约方向、杠杆时产生 open slot。
3. SemanticState -> CanonicalSpecV2 -> IR -> AST 保留持续订单语义。
4. Contract invariant 防止持续订单语义被降级成普通 signal。

部署和运行：

1. 含 `orderPrograms` 的 snapshot 分流到 grid runtime，不进入 SignalExecutor。
2. 初始化挂单符合 spot / perp long / perp short / perp neutral 模式。
3. 成交后补相邻反向单。
4. 部分成交幂等处理。
5. 重复同步不重复建 fill、不重复挂单。
6. 重启恢复能从本地状态和 OKX 订单恢复。
7. 越界停止撤销本 bot open orders。
8. 用户停止撤单并进入 STOPPED。
9. OKX 返回拒单、查单失败、订单不一致时进入 RECONCILE_REQUIRED 或 ERROR。

回归：

1. 普通 MA、RSI、布林等策略仍走 decision program 和 signal runtime。
2. 普通 signal 的单仓保护不影响 grid runtime。
3. 现有 strategy plaza 路径不受本设计影响。

---

## 14. 风险

1. 合约 neutral grid 对 OKX 持仓模式要求高。设计要求启动前校验，不满足时阻止启动。
2. 部分成交和订单同步容易重复处理。设计要求用 `clientOrderId`、exchange order id、fill id 组合做幂等。
3. Contract resolver 如果退回 key/family 分支，会破坏扩展性。设计要求发布 invariant 和测试覆盖禁止这种回退。
4. Grid runtime 绕过普通 signal 后，资金与仓位核算必须自成闭环。第一版用 grid 专属订单、成交、事件表建立可恢复账本。

---

## 15. 验收标准

1. 用户通过对话创建 OKX demo spot/perp 网格时，系统走完整 SemanticState -> CanonicalSpecV2 -> IR -> AST -> published snapshot 链路。
2. 语义层不依赖 `families`，编译主判断不依赖 atom key 或策略族。
3. 网格 snapshot 的 AST 包含 `orderPrograms`，部署后进入 grid runtime。
4. Grid runtime 能初始化挂 limit GTC 订单，同步成交，并在成交后挂反向单。
5. 重启后能恢复本地网格状态和 OKX 订单状态。
6. 越界停止和用户停止会撤销本 bot 的 open orders。
7. 普通策略的 signal runtime 行为不变。
