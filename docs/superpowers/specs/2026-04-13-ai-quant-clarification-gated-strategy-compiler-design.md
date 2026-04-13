# AI Quant Clarification-Gated Strategy Compiler Design

日期：2026-04-13

状态：设计已确认，待实现规划

## 1. 背景与目标

当前 AI Quant 主链路已经具备：

`natural language -> clarification -> canonical spec -> semantic view -> confirm -> IR -> AST -> compiled script -> publish -> backtest -> deploy`

但真实使用中仍有三类稳定性问题：

- 生成前追问门槛不完整，部分会改变执行语义的缺口没有被阻断
- `策略 -> 脚本 -> 回测 -> 部署` 之间虽然有一致性校验，但 summary 和 spec 仍存在自由文本二次猜测，导致语义漂移
- 当前支持的策略类型更多依赖模板句式，而不是稳定的语义原子，扩展新策略时容易退化

典型表现包括：

- 布林带中轨描述与 `MA20` 别名混用时，summary 或指标对齐漂移，最终命中 `CONSISTENCY_FAILED`
- “3 分钟内跌 1% 买入、15 分钟内涨 2% 卖出”这类规则缺少比较基准时，没有在生成前被稳定追问清楚
- 网格策略对区间、步长、格数和入场/出场语义的要求仍偏模板化，用户稍微自由表达就无法编译

本设计的目标是：

- 在不破坏当前主链路形状的前提下，把“生成前问清楚”升级为硬门槛
- 把 canonical spec 提升为 `策略 -> 脚本 -> 回测 -> 部署` 的唯一真相源
- 让新策略类型沿着“语义原子 + 澄清规则 + compiler + consistency”统一扩展，而不是继续堆 prompt 特判

## 2. 设计原则

### 2.1 一致性优先

- 没问清楚，不允许生成
- 用户确认后的 canonical 语义是唯一真相源
- 脚本、回测、部署都只能消费确认后的语义快照

### 2.2 交互自然，但阻断明确

- 每轮只问一个最高优先级问题
- 每次追问前先总结当前已理解的策略
- 对用户保持自然语言体验，对系统内部使用结构化 gate

### 2.3 扩展靠能力，不靠句式碰运气

- 新策略类型优先扩语义原子与澄清 schema
- prompt 只负责表达和增量整理，不负责偷偷补规则

## 3. 本次设计范围

### 3.1 包含

- 生成前阻断式澄清 gate
- planner / clarification 交互规范
- canonical checklist 与 canonical spec 的结构化升级
- summary / consistency 的真相源收敛
- 网格、布林、涨跌幅类策略的高通过率表达与扩展路径

### 3.2 非目标

- 不改变当前主链路顺序
- 不引入新的 DSL 编辑器
- 不在本设计中直接实现所有新策略类型
- 不修改回测或部署的真相源边界

## 4. 生成前硬门槛

### 4.1 必答项

在进入“确认逻辑图”或脚本生成之前，必须明确以下字段：

- 入场规则
- 出场规则
- 止盈止损规则
- 交易所
- 现货 / 合约
- 标的
- 周期
- 仓位

任意一项缺失，都必须停留在澄清态，不允许进入生成。

### 4.2 数值规则的比较基准

所有带 `%`、阈值、时间窗、序列条件的规则，如果会影响运行时语义，必须把比较基准问清楚。

首批纳入基准澄清的场景：

- `跌 1% 买入`
- `涨 2% 卖出`
- `止损 5%`
- `止盈 3%`
- `回撤 2%`
- `连续 N 根 K 线`
- `N 分钟内涨跌`

示例：

- `3 分钟跌 1% 买入`
  必须明确是“当前 K 线收盘价相对上一根 K 线收盘价下跌 1%”，还是别的基准
- `15 分钟涨 2% 卖出`
  必须明确是“当前 K 线收盘价相对开仓均价上涨 2%”，还是别的基准
- `止损 5%`
  必须明确是“持仓亏损达到 5% 强制平仓”，还是“价格相对入场价下跌 5%”

## 5. 澄清 Gate 设计

### 5.1 状态目标

生成前的 gate 要从“当前只拦部分问题”升级为“所有会导致误编译的缺口都能结构化阻断”。

### 5.2 阻断分类

首批统一抽象为以下阻断类型：

- `required_field_missing`
- `conflicting_market_scope`
- `missing_action_uniqueness`
- `missing_side_scope`
- `ambiguous_risk_effect`
- `ambiguous_condition_basis`

其中 `ambiguous_condition_basis` 是本次新增重点，要正式落地，而不是只停留在优先级枚举里。

### 5.3 优先级

每轮只问一个问题，优先级固定为：

1. 冲突消解
2. 核心交易语义补齐
3. 市场与运行范围补齐
4. 数值规则比较基准补齐
5. 策略类型专属参数补齐

### 5.4 用户可见问法

统一模板：

1. 先总结当前已理解的策略
2. 指出唯一一个会影响脚本生成一致性的缺口
3. 用一句自然语言追问

标准形态：

`我当前理解的策略是：……`

`现在还缺一个会影响脚本生成一致性的条件：……`

`请确认：……？`

禁止：

- 一次追问多个问题
- 在缺项未清空前说“逻辑已完整”
- 用问卷式堆叠多个字段

## 6. Planner Prompt 改造

planner 的职责从“判断大概能不能画流程图”升级成“维护可生成前置条件”。

新增硬约束：

- 只要 8 个必答项里仍有缺口，`logicReady=false`
- 只要任一百分比/阈值规则缺少比较基准，`logicReady=false`
- 在 `assistantPrompt` 中必须先总结当前理解，再问一个最高优先级缺口
- 禁止把“止盈止损阈值出场”这类泛化描述当成完整规则
- 禁止在缺关键字段时自行补默认交易语义

planner 可以代为补齐的仅限非核心元数据，并且只在用户明确允许“沿用 / 默认 / 你来定”的情况下发生。入场、出场、止盈止损和比较基准不得臆造。

## 7. Canonical Checklist / Spec 升级

### 7.1 当前问题

当前 checklist 更像文本容器，canonical spec、summary、consistency 都还会从自由文本再猜一次，导致：

- 布林中轨和 `MA20` 别名发生语义漂移
- 同一规则在不同阶段被抽象成不同粒度
- 新策略类型越来越依赖模板句式

### 7.2 目标结构

checklist 升级为“半结构化策略草案”，优先记录已经澄清过的字段，而不是只保留自由文本。

示意：

```ts
{
  market: {
    exchange: 'okx',
    marketType: 'perp',
    symbol: 'BTCUSDT',
    timeframe: '15m',
  },
  sizing: {
    positionPct: 10,
  },
  entryRules: [
    {
      type: 'bollinger_break',
      side: 'short',
      band: 'upper',
      trigger: 'close_break',
      timeframe: '15m',
    },
    {
      type: 'bollinger_break',
      side: 'long',
      band: 'lower',
      trigger: 'close_break',
      timeframe: '15m',
    },
  ],
  exitRules: [
    {
      type: 'bollinger_revert',
      target: 'middle_band',
      action: 'close',
    },
  ],
  riskRules: [
    {
      type: 'stop_loss_pct',
      valuePct: 5,
      basis: 'position_pnl',
      action: 'force_exit',
    },
    {
      type: 'bollinger_outside_bars',
      bars: 3,
      action: 'reduce',
    },
  ],
}
```

### 7.3 真相源约束

- canonical spec 只从“已确认 checklist”派生
- 一旦结构化字段已存在，后续禁止再由自由文本反向覆盖
- summary 和 consistency 统一从 canonical spec / compiled projection 派生，不再自由读原始 message

## 8. Summary / Consistency 收敛

### 8.1 目标

把当前的：

`自由文本 -> summary -> spec -> script -> summary 对齐`

收敛成：

`已澄清 checklist -> canonical spec -> compiled projection -> consistency`

### 8.2 约束

- `userIntentSummary` 从已确认 checklist 导出
- `strategySummary` 只从 canonical spec 导出
- `scriptSummary` 只从 compiled projection 导出
- 布林中轨别名统一归入布林语义，不得隐式升级为 `sma`
- 如果 canonical spec 未显式声明 `sma`，脚本不应因为出现 `MA20` 文案而被要求声明 `sma`

### 8.3 目标收益

这会直接降低以下问题：

- `summary 对齐失败`
- `脚本缺少关键指标: sma`
- 用户写的是布林带回中轨，但系统在某一层把它解释成均线策略

## 9. 语义原子扩展模型

后续扩策略类型时，不再以“整句模板”扩，而是以语义原子扩。

首批原子：

- `bollinger_break`
- `bollinger_middle_revert`
- `bollinger_outside_bars`
- `price_change_pct`
- `position_pnl_pct`
- `grid_level_touch`
- `ma_cross`
- `rsi_threshold`
- `macd_cross`
- `time_stop_bars`

每种语义原子必须配套四件套：

- clarification rules
- canonical mapping
- compiler / semantic graph support
- consistency mapping

这样新增 Donchian、ATR breakout、分批止盈时，仍然沿同一扩展路径，不会继续堆 prompt 特判。

## 10. 网格策略专项方案

### 10.1 当前约束

当前网格策略更偏固定模板，需要明确：

- 区间上下界
- 步长
- 格数
- 入场语义
- 出场语义

### 10.2 设计调整

- 自然语言归一化：
  - `千分之 5` 归一化为 `0.5%`
  - `不断低买高卖` 拆成 `价格触达下方网格买入 / 价格触达上方网格卖出`
- 追问补齐：
  - 若缺区间、步长、格数、单边/双边方向中的任意一项，则继续追问
- 反馈改写：
  - 不再直接返回“未识别可编译入场/出场规则”
  - 改为“我已理解为固定区间网格策略，但还缺一个会影响脚本生成一致性的条件：……”

## 11. 用户高通过率输入模板

### 11.1 布林带

`在 OKX 合约市场交易 BTCUSDT，周期 15m。入场：收盘价突破布林带上轨时做空，收盘价跌破布林带下轨时做多。出场：价格回到布林带中轨时平仓。止损：持仓亏损达到 5% 强制平仓。附加规则：价格连续 3 根 K 线运行在轨外时减仓。仓位 10%。`

### 11.2 涨跌幅触发

`在 OKX 现货市场交易 BTCUSDT。入场周期 3m：当前 K 线收盘价相对于上一根 K 线收盘价下跌 1% 时买入。出场周期 15m：当前 K 线收盘价相对于开仓均价上涨 2% 时卖出。止损：持仓亏损达到 5% 强制卖出。仓位 10%。`

### 11.3 网格

`在 OKX 永续合约市场交易 BTCUSDT，周期 15m。固定区间 60000 到 80000，步长 0.5%，共 58 格。入场：价格触达下方网格时买入。出场：价格触达上方网格时卖出。仓位 10%。`

## 12. 前端与接口反馈

用户主提示统一采用解释型文案：

- `我已经理解了策略的大部分内容，但还不能安全生成脚本，因为还缺一个会影响一致性的条件：……`
- `请补充后我再继续生成。`

内部调试信息继续保留：

- `CONSISTENCY_FAILED`
- `entry_rules_not_mapped`
- `exit_rules_not_mapped`
- `grid_params_missing`

但默认只用于日志、开发态或高级诊断，不作为首屏主提示。

## 13. 验收与测试

本设计的实现验收至少覆盖：

- 布林中轨与 `MA20` 别名不再误判成 `sma` 缺失
- `3 分钟跌 1% 买入` 在缺少 basis 时进入阻塞澄清
- `止损 5%` 在缺少 basis 时进入阻塞澄清
- `单笔使用 10% 资金` 可稳定归一化为 `positionPct=10`
- `千分之 5` 可归一化为 `0.5%`
- 网格缺格数时继续追问，不进入逻辑图确认
- planner 每轮先总结当前理解，再只追问一个问题
- 缺项时绝不生成占位脚本

本轮设计核对时已参考并复核以下现状证据：

- 澄清提问优先级与单题输出逻辑
- planner 的 `logicReady` 语义约束
- 布林 / 涨跌幅 / 网格相关现有单测
- summary builder 与 semantic graph builder 的现状行为

## 14. 风险与后续

### 14.1 风险

- checklist 结构升级后，需要谨慎处理旧会话兼容
- summary 真相源切换后，部分历史容错逻辑会收紧，短期内可能暴露更多“本就不完整”的用户输入
- 网格与涨跌幅类策略的自然语言归一化若做得过宽，仍可能引入误判

### 14.2 后续建议

实现顺序建议为：

1. 落地阻塞 gate 与 `ambiguous_condition_basis`
2. 改 planner prompt 和澄清文案
3. 收敛 canonical checklist / spec 真相源
4. 收敛 summary / consistency
5. 补网格与涨跌幅归一化
6. 按语义原子模式扩更多策略类型

## 15. 结论

本设计选择 `Hybrid gate` 路线：

- 用结构化 gate 守住生成前门槛
- 用 canonical spec 守住策略到脚本、回测、部署的一致性
- 用语义原子守住后续策略扩展的可持续性

这条路线比单纯调 prompt 更稳，比完全 schema-first 更符合自然对话体验，也最符合“在强一致前提下融合更多量化策略”的目标。
