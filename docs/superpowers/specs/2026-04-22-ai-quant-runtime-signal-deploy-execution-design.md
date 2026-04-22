# AI Quant Runtime Signal Deploy Execution 修复方案

日期：2026-04-22  
状态：Draft for review（目标态设计，非当前实现现状）  
范围：Issue 856 / publishedSnapshot -> deploy -> runtime signal -> execution -> OKX testnet

---

## 1. 背景

当前 AI Quant 主数据流已经基本建立并在 staging 上验证了前半段链路可用：

- 自然语言策略进入 clarification gate
- canonical spec v2 / semantic view(specDesc) 生成
- 用户确认 canonicalDigest
- IR / AST / compiled script 生成
- publish 产出 `publishedSnapshotId`
- backtest 可以成功运行
- deploy 可以成功绑定 OKX testnet 账户并把实例推进到 `running + TESTNET`

但 staging 实际复跑结果表明，问题仍然存在于 deploy 之后：

- runtime 已经触发
- `runtimeExecutionStates` 从 `ready` 进入失败态
- 失败原因为 `SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`
- `strategy_signals = 0`
- `user_signal_executions = 0`
- `positions = 0`

进一步排查表明：

- publishedSnapshot 对应的 compiled runtime 决策已经能够算出合法 `OPEN_LONG`
- 但 runtime 后续又走了一层 strict signal payload 校验
- 这层会因为缺少某些附加字段而把合法决策折叠成 no-signal

因此当前的核心问题不是：

- OKX testnet 不支持 spot
- deploy 快照不够支撑 testnet 发布
- 账户未绑定或 deploy 未成功

而是：

> deploy 后 runtime 对同一份 publishedSnapshot 又使用了另一套信号出口规则，导致合法 compiled decision 在 signal 创建前被错误吞掉。

---

## 2. 问题定义

本次要修复的不是“页面文案不准确”，也不是“针对 ORDIUSDT/OKX/on_start 的临时特判”，而是：

> deploy/runtime 必须只消费用户确认并发布后的 `publishedSnapshot` 真相，不依赖某次具体 backtest 请求参数，也不能在 runtime 再用另一套规则否决同一份 compiled decision。

当前错误边界可归纳为：

```text
publishedSnapshot
-> compiled decision (已合法)
-> strict signal payload 否决
-> SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL
-> 无 strategy_signals
-> 无 user_signal_executions
-> 无 broker order
```

这意味着：

1. backtest 与 runtime 对同一份 publishedSnapshot 的解释不一致
2. runtime 把“真 no-signal”和“有决策但缺执行真相”混淆了
3. downstream execution / broker 层根本没有机会运行

---

## 3. 目标

### 3.1 核心目标

建立一条可落地修复当前问题的执行链路：

```text
用户确认策略
-> publish / publishedSnapshot
-> backtest 通过
-> deploy 成功
-> runtime 自动触发
-> strategy_signals
-> user_signal_executions
-> OKX testnet 下单链路
```

### 3.2 成功标准

对“用户确认 + 回测通过 + deploy 成功”的策略，必须满足：

1. deploy/runtime 只消费 `publishedSnapshot` 真相 + 账户/执行绑定
2. runtime 自动触发时，合法 compiled decision 必须创建 `strategy_signals`
3. signal 创建后必须进入 `user_signal_executions`
4. execution 必须继续推进到 OKX testnet 下单路径
5. 不再因为另一套 strict signal 校验而落成 `SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL`
6. 如果最终未下单，失败点必须体现在 execution / broker 层，而不是伪装成 no-signal

### 3.3 非目标

本次不做：

1. 不重构 clarification / semantic / publish 主链路
2. 不把回测请求参数混入 deploy/runtime 输入
3. 不为 ORDIUSDT / OKX / on_start 单独加特判
4. 不先重构整个 broker / execution 领域模型
5. 不对测试环境保留历史 strict payload 兼容路径
6. 不自动补齐默认值掩盖缺口（如 confidence / stopLoss / takeProfit）

---

## 4. 设计原则

### 4.1 Deploy/runtime 只消费 publishedSnapshot 真相

deploy/runtime 使用的输入只能来自：

- `publishedSnapshotId`
- snapshot 绑定的真相字段（exchange / marketType / symbol / timeframe / positionPct / execution semantics / compiled script）
- 账户绑定和执行环境（exchangeAccountId / TESTNET / LIVE / execution constraints）

不能依赖：

- 历史回测区间
- 初始资金
- 滑点
- 手续费
- allowPartial
- 某次具体 backtest 的 priceSource
- 其他一次性实验参数

### 4.2 Runtime 直接消费 compiled decision

> 说明：本节描述的是目标实现方向。当前代码仍存在 strict signal payload 否决路径，本设计的目的正是替换该路径，而不是宣称现状已经完成。

一旦 publishedSnapshot 对应的 compiled runtime 已经算出合法 `StrategyDecisionV1`，runtime 的目标态应直接进入 signal 创建，不再额外使用另一套“AI-like payload 完整性校验”去重新定义这是不是 signal。

### 4.3 缺字段先真理化，不补默认值

本次不通过默认值“修平”问题。

如果缺：

- confidence
- stopLoss
- takeProfit
- 或其他 signal/execution 必需字段

系统必须显式暴露真实缺口，让后续产品 / 策略层决定：

- 是用户页面需要填写
- 还是策略真相层需要增加
- 还是 execution binding 层需要补充

### 4.4 Signal 创建后，失败位置必须前移到 execution 层

这次修复的目标不是“把 no-signal 文案改掉”，而是把链路真正推进到：

```text
strategy_signals -> user_signal_executions -> OKX testnet order
```

如果后续仍失败，应该失败在：

- 订阅账户选择
- 订单参数构建
- 账户币种约束
- broker reject
- execution 记录

而不是回退成 `NO_SIGNAL`。

---

## 5. 推荐方案

本次推荐采用：

> **方案 B：runtime decision adapter**

### 方案定义

> 说明：以下链路是本次建议落地的目标结构；当前实现尚未完成迁移。

新增或重构一层清晰的 runtime 决策出口：

```text
publishedSnapshot
-> compiled decision
-> RuntimeSignalIntent
-> strategy_signals
```

替代当前的：

```text
compiled decision
-> strict AI-like payload 校验
-> invalid => no-signal
```

### 为什么推荐

1. 能修复当前问题
2. 不依赖任何一次具体 backtest 的参数
3. 不污染主数据流前半段
4. 不需要先重构 broker 领域模型
5. 不是 case patch，而是修正 backtest/runtime 的语义分叉边界

---

## 6. 最新实现路线修正

在按上述方案推进后，Task 5 的无兜底 E2E 暴露出一个更深层、且优先级更高的系统问题：

1. **deploy 完成前，实例已经对 runtime scheduler 可见**
2. **signal 创建后，execution 自动接力缺少运行时持续补偿**

因此，本设计的最新落地顺序应修正为：

### 第一阶段：deploy -> runtime readiness barrier

目标不是再解释策略，而是修正“什么时候一个实例才允许被 runtime 消费”：

- 给 `strategy_instances` 增加显式 runtime binding readiness 状态
- deploy repository 只做 binding preparation，不再直接把实例切成 `running`
- deploy service 在 risk profile / runtime states / deploy success 全部完成后再显式激活实例
- scheduler 只扫描 `READY` 的实例

### 第二阶段：execution 持续补偿

保持现有 event-driven execution 方向不变，只补运行时持续补偿：

- 保留 `StrategySignalEvents.CREATED` 快路径
- 将 `recoverPendingSignals()` 从“启动时一次”升级为“运行时持续”的 recovery 慢路径

### 第三阶段：重新验证无兜底自动链路

只有在第一、二阶段完成后，Task 5 的无兜底 E2E 才能真正证明：

```text
deploy -> runtime auto trigger -> strategy_signals -> user_signal_executions -> execution
```

### 这次修复明确不做的事

- 不重新编译或重猜用户意图
- 不往策略快照里混入回测参数
- 不通过默认值补齐让链路“假跑通”
- 不先重构 broker adapter / 整个 execution 领域模型

---

## 7. 目标状态与分层边界

### 7.1 四层边界

#### 第 1 层：策略真相层
定义“这是什么策略”

- canonical spec v2
- semantic view
- confirmed canonicalDigest
- IR / AST / compiled script
- publishedSnapshot truth

#### 第 2 层：回测实验层
定义“怎么验证这份策略”

- 历史区间
- 初始资金
- 滑点 / 手续费
- allowPartial
- 杠杆

#### 第 3 层：部署绑定层
定义“这份策略绑定到哪个账户执行”

- exchangeAccountId
- TESTNET / LIVE
- execution defaults / constraints

#### 第 4 层：运行执行层
定义“现在有没有真正生成 signal 并进入交易所执行”

- compiled decision
- strategy_signals
- user_signal_executions
- broker order
- positions

### 7.2 本次修复的层次重点

当前 staging 与本地 E2E 已共同证明：

- 第 1 层能完成 publish
- 第 2 层能完成 backtest
- 第 3 层在“绑定成功”层面能完成 deploy

但第 3 层与第 4 层之间的**交接协议**仍有问题：

- deploy 过早暴露 `running`
- runtime 在实例尚未完全 ready 时抢跑
- signal 创建后的 execution 自动接力没有持续补偿

所以本次修复虽然不改变前 1～2 层的真相定义，但会同时修正：

- 第 3 层的 readiness barrier
- 第 4 层的 execution continuity

---

## 7. 模块级修改清单

## 7.1 必改模块

### A. `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts`

#### 当前职责问题
此处是 deploy 后 runtime signal 生成的主入口，但目前在 compiled decision 之后又引入了严格 payload 否决路径，导致合法 decision 被折叠成 no-signal。

#### 本次改动目标
将 runtime 主链路改为：

```text
compiled decision
-> runtime signal intent
-> createSignalWithCooldownAndLock
```

#### 具体要求

- 不再用 strict payload 否决合法 decision
- 显式区分：
  - `noop`
  - `signal`
  - `missing_required_truth`
- 对 `signal` 分支继续推进 signal 落库
- 对 `missing_required_truth` 分支记录结构化 failure reason，而不是 generic no-signal

---

### B. `apps/quantify/src/modules/strategy-signals/services/signal-generation-decision.stage.ts`

#### 当前职责问题
当前更像“严格 AI signal payload 审核器”，不适合作为 publishedSnapshot runtime 的最终决策出口。

#### 本次改动目标
将其重心改为：

> `StrategyDecisionV1 -> RuntimeSignalIntent`

#### 具体要求

- 输入：合法的 `StrategyDecisionV1`
- 输出结果分为：
  - `signal`
  - `noop`
  - `missing_required_truth`
- 不再把缺 confidence/stopLoss/takeProfit 直接视为 no-signal
- 失败时给出结构化原因，便于 UI / detail / staging 验证使用

---

### C. `apps/quantify/src/modules/strategy-runtime/strategy-protocol.util.ts`

#### 当前职责
已承载：

- `resolveStrategyOutput`
- `strategyDecisionToSignalPayload`
- `StrategyDecisionV1` 语义校验

#### 本次改动目标
保留其作为统一决策语义底座，并视需要新增：

- `strategyDecisionToRuntimeSignalIntent(...)`

#### 要求

- runtime / backtest 不再各自分叉解释 `StrategyDecisionV1`
- 这里仍只负责“决策语义转换”，不负责账户/broker 逻辑

---

### D. `apps/quantify/src/modules/strategy-signals/services/signal-generation-persistence.stage.ts`

#### 当前职责
负责真正落 `strategy_signals`。

#### 本次改动目标
接受新的 RuntimeSignalIntent，并推进 signal 落库。

#### 要求

- 有 signal 时正常落库
- metadata / runtimeProvenance 继续保留
- 不在 persistence 层二次解释策略或回退成 no-signal

---

## 7.2 需要核对但不作为主改点的模块

### E. `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`

#### 作用
确认 signal 创建后能够被 execution 正常消费，并继续走到 OKX testnet。

#### 本次核对点

- spot 场景 order params 构建
- `positionSizeRatio / positionSizeQuote` 到订单量的转换
- 账户币种 / quote asset 约束
- OKX testnet spot 下单路径是否被调用

#### 原则
先不做大改；若 signal 打通后 execution 暴露 broker 问题，再局部修 execution 层。

---

### F. `apps/front/src/app/[lng]/ai-quant/ai-quant-page-deploy.ts`

#### 作用
确认 deploy 只消费 publishedSnapshot 真相 + execution binding。

#### 原则

- 不引入回测参数依赖
- 不前端补假默认值
- 不将这次 bug 通过页面层规避掉

---

### G. `apps/front/src/components/account/AiQuantStrategyDetail.tsx`

#### 作用
展示层联动。

#### 原则

- 可以联动显示新的结构化 failure reason
- 但不是本次逻辑修复入口

---

## 7.3 明确不要动的模块

### 不动主数据流前半段

- clarification gate
- canonical spec v2
- semantic view
- confirm canonicalDigest
- IR / AST / compiled script
- publish

### 不把回测参数带进 deploy/runtime

- 回测区间
- 初始资金
- 滑点
- 手续费
- allowPartial
- 某次 backtest 的 priceSource

### 不先动 OKX broker adapter 作为主修复点

当前问题尚未进入 broker 层，不应优先修改 adapter。

---

## 8. 失败语义重构

### 当前问题
`SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL` 过于粗糙，把多种情况混成一个结果。

### 目标
至少拆出两类：

#### 1. 真 no-signal
- compiled decision 确实是 `NOOP`

#### 2. 有决策但缺执行真相
例如：
- `SIGNAL_DECISION_INCOMPLETE`
- `SIGNAL_EXECUTION_INPUT_MISSING`
- 或其他更具体的 runtime failure code

### 原则
不能再把“有决策但缺字段”伪装成“根本没有 signal”。

---

## 9. 测试策略

## 9.1 集成测试（必须补）

### 1. `publishedSnapshot + spot + on_start + OPEN_LONG + RATIO`
验证：
- runtime 后成功创建 `strategy_signals`
- 不再落成 generic no-signal

### 2. 真 `NOOP`
验证：
- 仍正确落成 no-signal
- 不错误创建 signal

### 3. 有决策但缺执行真相
验证：
- 返回结构化缺口原因
- 不再伪装成 no-signal

### 4. signal 创建后 execution 可消费
验证：
- 至少创建 `user_signal_executions`
- execution 开始进入真实消费链路

## 9.2 E2E（必须补）

### 5. deploy 后自动触发主链路
验证：

```text
deploy -> instance running -> runtime auto trigger -> signal -> execution
```

### 6. OKX testnet spot smoke
验证：
- signal 创建后 execution 确实进入 OKX testnet 现货下单路径
- 若 CI 不适合直连真实 testnet，则至少要有 broker integration smoke + staging 验收组合

## 9.3 staging 验收（保留）

继续保留：
- deploy 成功
- instance `running + TESTNET`
- signal 创建
- execution 创建
- 确认真实走到 OKX testnet

---

## 10. 风险与权衡

### 风险 1：signal 创建后暴露 execution 层新问题
这是可接受的。

理由：这说明链路终于推进到了真实执行层，失败点比当前更接近根因。

### 风险 2：去掉 strict payload 兼容路径后影响旧测试数据
当前为测试环境、未上线，可接受硬切，不保留历史兼容负担。

### 风险 3：缺字段路径暴露后，产品决策尚未完成
本次方案故意不补默认值，因此会让缺口显性化。这是设计目标，不是副作用。

---

## 11. 一句话总结

> 本次修复不是补快照字段，不是带回测参数，也不是先改 OKX adapter；而是把 deploy 后 runtime 的决策出口修直，让 publishedSnapshot 产出的合法 compiled decision 能稳定进入 `strategy_signals -> user_signal_executions -> OKX testnet` 链路。
