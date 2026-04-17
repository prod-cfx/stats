# AI Quant Generic Semantic And Gate Follow-up Design

日期：2026-04-17

状态：设计已确认，待实现规划

## 1. 背景

`#818` 合并后，AI Quant 仍存在两类真实回归：

1. 用户表达了完整网格意图，但像“低买高卖”这样的自然语言语义没有被稳定承接，导致系统继续把它当成“核心交易语义缺失”。
2. 逻辑图已确认、语义也已完整时，确认生成代码仍会被旧的 `entryRules/exitRules` gate 拦回去，提示“请先补全入场和出场规则，再确认生成代码”。

这两个问题的共同点不是某个单独策略类型坏了，而是：

- 系统里仍存在一条依赖 legacy checklist bucket 的旧门禁；
- 某些自然语言交易语义仍被当成“某个策略特有写法”来处理，而不是更底层的通用语义资产。

本次修复的前提非常明确：

- **不动主数据流整体**
- 继续沿用现有 `message -> checklist/semantic state -> clarification -> canonical spec -> compileability` 主链
- 只在当前链路上收敛语义来源与生成门禁

## 2. 目标

本次目标：

1. 让“低买高卖 / 高卖低买”这类自然语言交易语义进入**策略无关**的通用语义识别层，而不是绑死在某个策略实现里。
2. 让后续新增策略也能复用同一套通用语义，而不是继续扩 family / kind / 策略特例判断。
3. 让“确认生成代码”的最终门禁只看：
   - semantic snapshot 是否已补齐必需槽位
   - canonical spec 是否可编译
4. 彻底取消 `missing_entry_rules / missing_exit_rules` 这类 legacy clarification 项。
5. 保留现有主数据流与会话结构，避免为这次修复重构整条链路。

## 3. 非目标

- 本次不重构 semantic snapshot 主体结构。
- 本次不重写 canonical compiler、clarification state 或 session persistence 主链。
- 本次不引入新的 strategy family / strategy kind / 策略注册表。
- 本次不立即物理删除 `entryRules/exitRules` 字段本身。
- 本次不改成“所有策略都必须先回写 legacy 文案才能生成代码”。
- 本次不改变已调通策略的既有识别与生成行为，除非修复这两个问题所必需。

## 4. 问题定义

### 4.1 通用语义表达没有作为底层资产承接

当前像“低买高卖”这样的表达，虽然在个别链路里已有零散识别，但没有成为稳定的、策略无关的语义输入。因此它会出现：

- 某些阶段识别得到
- 某些阶段识别不到
- 一旦落回 legacy checklist / old gate，就又被当成“缺入场/出场规则”

这本质上是“语义来源不统一”的问题。

### 4.2 生成门禁仍被 legacy checklist bucket 绑住

当前确认生成代码时，即便：

- semantic snapshot 已完整
- canonical spec 已可编译

系统仍然会额外检查 `entryRules/exitRules` 是否为空，只要为空就阻塞生成。

这说明旧 bucket 仍在承担主职责，而不是只做兼容投影。

## 5. 方案对比

### 5.1 方案一：继续给网格策略补关键词特判

思路：

- 在网格 normalizer 或 reducer 里继续给“低买高卖”补特判

问题：

- 只修当前 case
- 继续把语义绑在某个策略实现上
- 后续新策略还会重复踩坑

结论：

- 不采用

### 5.2 方案二：直接删除 legacy checklist 并全量切 semantic snapshot

思路：

- 彻底删除 `entryRules/exitRules` 的生成、投影与读取路径

优点：

- 架构最干净

问题：

- 触达范围过大
- 与“不要动主数据流整体”的边界冲突

结论：

- 当前阶段不采用

### 5.3 方案三：保留主链，收敛通用语义输入与生成门禁

思路：

- 新增一层更底层的**策略无关通用语义识别**
- semantic snapshot / canonical compileability 成为唯一生成门禁
- legacy checklist bucket 退出 gate 和 clarification 主职责，只保留兼容投影

优点：

- 不改主数据流
- 可覆盖当前网格 case
- 可服务后续新增策略

结论：

- 本次采用

## 6. 核心设计

### 6.1 通用语义层：不带策略归属

在现有策略特定归一化之前，增加一层**策略无关的行为语义识别**。

这层不回答“它属于哪种策略”，只回答“用户明确表达了什么交易行为语义”。

例如：

- `低买高卖` / `高卖低买`
- `回落买入` / `反弹卖出`
- `突破追多` / `跌破追空`

这些表达先被识别为通用语义信号，随后由现有 semantic snapshot、normalizer、compiler 在当前上下文中消费。

关键约束：

- 这层**不引入 family 维度**
- 这层**不绑定具体策略**
- 这层输出必须能被后续新增策略复用

### 6.2 现有主链保持不变

主链仍然是：

`用户消息 -> checklist/semantic state -> clarification -> canonical spec -> compileability`

本次只允许做两类收敛：

1. 通用语义输入在更早位置统一识别
2. 生成门禁只信 semantic readiness + compileability

禁止事项：

- 不把整个系统切成新数据流
- 不替换 session 主结构
- 不为了修本次问题新增策略级分发中心

### 6.3 legacy checklist bucket 退为兼容投影

`entryRules/exitRules` 仍可暂时保留，但角色改变：

- **不再作为生成门禁**
- **不再产生 `missing_entry_rules / missing_exit_rules` clarification**
- **不再作为“策略是否完整”的判断依据**

保留它们的唯一目的，是在当前仓库里继续兼容：

- 老会话读取
- 摘要展示
- 旧投影消费路径

也就是说，本次不是立即删字段，而是先让它们退出“真相层职责”。

## 7. 数据流影响

### 7.1 语义识别

新增的不是新主链，而是现有识别阶段中的一个更底层步骤：

`message -> generic semantic cues -> existing semantic normalization`

generic semantic cues 只提供额外证据，不直接重写后续状态机。

### 7.2 澄清链路

clarification 不再允许因为缺少 `entryRules/exitRules` 而发问。

澄清只能来自：

- semantic snapshot 中仍未闭合的槽位
- execution context 缺口
- canonical compile 所需但尚未闭合的核心条件

### 7.3 生成链路

确认生成代码时，唯一有效的阻塞条件是：

1. semantic snapshot 仍有 open slot
2. canonical spec 不可编译

如果这两条都满足通过，则直接生成，不再回头检查 legacy checklist bucket。

## 8. 测试策略

本次至少补齐以下回归测试：

1. 真实对话回归：
   - 初始消息含网格区间、步长、仓位与“低买高卖”
   - 回答 `15m`
   - 回答 `低买高卖`
   - 回答止损、止盈
   - 确认逻辑图后可以进入生成，不再被旧 gate 拦住

2. 通用语义回归：
   - `低买高卖` 被识别为通用行为语义，而不是只在某个策略分支里生效

3. legacy clarification 退役回归：
   - 不再产出 `missing_entry_rules`
   - 不再产出 `missing_exit_rules`

4. 生成门禁回归：
   - `entryRules/exitRules` 为空但 semantic snapshot 完整、canonical spec 可编译时，允许生成

5. 已调通策略非回归：
   - `在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金`
   - `在ok交易所 我想在btc-usdt-swap 15分钟布林带 上轨做空 下轨做多 单笔百分10资金`
   - 上述两类策略在识别、澄清、逻辑图确认与生成门禁上都不得因为本次修复而退化

## 9. 风险与约束

主要风险：

1. 旧代码可能仍有零散路径读取 `missing_entry_rules / missing_exit_rules`
2. `entryRules/exitRules` 退役后，部分旧摘要文案可能需要调整
3. 通用语义识别如果做得太激进，可能把普通描述误当成强语义
4. 修复这两个问题时，误伤已调通的单腿策略与布林带策略

控制方式：

- 仅增加最小通用语义集合，不做大范围词典扩张
- 保持语义 cue 为“提供证据”，而不是直接替代下游判断
- 用真实多轮会话回归锁住确认生成链路
- 把已调通的单腿策略与布林带策略加入非回归测试，确保行为不退化

## 10. 实施边界

本次实现必须满足：

1. 不动主数据流整体
2. 不新增策略级 family 分发层
3. 不把修复写成网格特例补丁
4. 不再依赖 `entryRules/exitRules` 做 gate 和 clarification
5. 对后续新增策略可复用
