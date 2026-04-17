# AI Quant Atomic Semantic Snapshot Design

日期：2026-04-16

状态：设计已确认，待实现规划

## 1. 背景

当前 AI Quant 会话链路已经明显向 `normalizer -> semanticState` 迁移，但这条链在“跨轮保留复杂策略语义”上仍不稳定。

已确认的失败样例：

- 用户首轮表达网格语义：
  `在 ok 交易所我想弄个网格策略 btc 永续合约 在 60000-80000 的区间 每一格千分之 5 不断低买高卖 单笔百分 10 资金`
- 系统首轮能够识别出网格方向，并正确追问缺失的主周期
- 用户第二轮只回答：
  `15m`
- 系统却退化为：
  `请补充至少一条明确的入场规则`

这说明问题不在于系统完全不认识网格，也不在于 `normalizer` 从未能识别复杂语义，而在于：

- 已经识别出来的 atomic semantics 没有作为稳定的跨轮状态资产被保住
- 下一轮续聊时，系统仍可能回到较弱的文本投影或 fallback 逻辑
- 一旦本轮解析结果比上轮更弱，旧语义就会被冲掉，最终退化成 generic clarification

本次设计不是要把系统重新拉回策略 family 模式，也不是要再造一套按策略类型扩展的数据模型，而是要给现有 atomic semantics 增加一个正式的、可 merge、可持久化的跨轮快照层。

## 2. 目标

本次设计目标：

1. 让 `normalizer` 已经识别出的 atomic semantics 在会话续聊时不丢失。
2. 同时支持两类状态：
   - 已闭合的语义
   - 方向已识别但仍需继续追问的未闭合语义
3. 续聊时优先基于持久化 atomic snapshot 做 merge，而不是回退到 generic missing-rule 推断。
4. 不再为网格、布林、均线等策略额外引入新的策略 `kind` 数据结构。
5. 保持当前系统继续向通用量化策略演进，不把状态层设计成只能服务少数模板策略。
6. 结构上为未来升格为单一真源留出口，但职责上本次只解决“续聊不丢语义”。

## 3. 非目标

- 本次不把 atomic snapshot 直接升级为 `clarification / canonical spec / compile` 的唯一真源。
- 本次不重写 `normalizer` 的语义原子体系。
- 本次不引入新的策略 family / strategy kind 注册表。
- 本次不靠 prompt patch 或关键词补丁修单个网格案例。
- 本次不要求所有历史 session 立刻具备完整新能力；只要求兼容读取与平滑迁移。

## 4. 问题定义

本次需要解决的核心问题是：

`normalizer` 已经识别出的 atomic semantics，在后续轮次没有被当成 authoritative session asset 持久化和 merge。

因此当前会出现三类退化：

1. **已识别语义丢失**
   上轮已识别出网格、区间、步长、低买高卖等语义，本轮只补 `15m`，却因为本轮未再次提到网格而把旧语义冲掉。

2. **未闭合语义被降级**
   用户表达了“区间自动买卖、突破停掉”这种方向明确但参数未齐的语义，系统没有保留 open semantics，而是退回“缺入场规则”。

3. **本轮解析变弱时旧轮真相被覆盖**
   本轮 message 只补少量信息，或 `normalizer` 本轮只识别出上下文 / 风控，旧轮更完整的 atomic semantics 却没有被保住。

本质上，这是会话状态承接与 merge 的问题，不是单个策略识别规则的问题。

## 5. 方案对比

### 5.1 方案一：继续补 projection/fallback

思路：

- 在 `semanticState -> legacy projection` 或 clarification fallback 里继续为网格等案例补逻辑

优点：

- 实现最快

缺点：

- 仍是按案例打补丁
- 每来一种复杂策略都要继续补
- 无法支撑通用量化策略方向

结论：

- 不采用

### 5.2 方案二：直接把整个 `semanticState` 升为唯一真源

思路：

- 让 `semanticState` 直接接管 clarification、canonical spec、compile 等全部链路

优点：

- 架构最干净

缺点：

- 范围过大
- 与本次“只解决续聊不丢语义”的边界不匹配

结论：

- 当前阶段不采用

### 5.3 方案三：新增 Atomic Semantic Snapshot 持久化层

思路：

- `normalizer` 继续产出 atomic semantics
- 在其后新增一个正式的持久化快照层，保存当前 active 的 atomic semantics、open slots、evidence 与 supersede 关系
- 续聊时使用：
  `persisted atomic snapshot + current normalizer result -> merge -> next persisted snapshot`

优点：

- 不需要新增策略 kind
- 直接复用现有 atomic semantics 体系
- 同时覆盖闭合与未闭合语义
- 可逐步演进为更强的 session 真相层

缺点：

- 需要补一层持久化与 merge 规则

结论：

- 本次采用

## 6. 核心设计

### 6.1 总体原则

1. **不保存策略类型，保存语义原子**
   持久化层不以“网格策略 / 布林策略 / 均线策略”建模，而是以现有 trigger / action / risk / position / context 等 atomic semantics 建模。

2. **不要求完全闭合后才持久化**
   只要 `normalizer` 已经识别出语义方向，就应持久化为 active snapshot，即使仍存在 open slots。

3. **不允许本轮弱结果覆盖上轮强结果**
   本轮未提及的旧语义默认保留；本轮只补充新增显式信息。

4. **续聊只问 merge 后仍为 open 的语义槽位**
   clarification 不应因为 snapshot 存在 open semantics 而回退成 generic missing rule。

### 6.2 新增对象：Atomic Semantic Snapshot

新增一个独立持久化对象，暂命名为：

`atomicSemanticSnapshot`

它不是新的策略模型，而是当前 session 中“已经识别出的 atomic semantics 快照”。

推荐结构：

```ts
interface AtomicSemanticSnapshot {
  version: 1
  contextSlots: SemanticContextSlotState
  triggers: SemanticTriggerState[]
  actions: SemanticActionState[]
  risk: SemanticRiskState[]
  position: SemanticPositionState | null
  normalizationNotes: string[]
  updatedAt: string
  updatedTurnId?: string
}
```

关键点：

- 结构直接复用现有 `semantic-state.ts` 里的通用 atomic 结构
- 不新增 `grid`、`bollinger`、`ma` 等策略级 `kind`
- `open / locked / superseded` 三态继续成立
- `evidence.source` 继续区分 `user_explicit / inferred / derived`

### 6.3 与现有 `semanticState` 的关系

本次不强行改名或替换全仓库术语。

若仓库当前已有 `semanticState` 并与上述结构高度一致，则本次实际落地可以是：

- 将当前 `semanticState` 明确为“atomic semantic snapshot”
- 或在 session 层新增独立字段承载 snapshot，再与现有 `semanticState` 做兼容桥接

本次设计要求的是职责边界，而不是名字必须变化：

- 它必须作为续聊保真层存在
- 不能只是临时缓存
- 不能再依赖文本 projection 才能恢复语义

## 7. 数据流

### 7.1 Start / Continue 主链

新数据流：

`用户消息 -> normalizer -> current atomic semantics -> merge with persisted snapshot -> next atomic snapshot -> clarification / summary / downstream projections`

其中：

- `normalizer` 继续负责语义识别
- snapshot 层负责跨轮保真
- merge 层负责覆盖 / 保留 / supersede

### 7.2 本次职责边界

本次 snapshot 层只负责：

1. 保存已识别 atomic semantics
2. 保存 open slots
3. 续聊时进行 atomic merge
4. 为 clarification 提供“当前仍未闭合的语义缺口”

本次 snapshot 层暂不直接负责：

- canonical spec 构建
- publication / compile 主数据流
- 最终部署前的唯一真相判定

## 8. Merge 规则

### 8.1 同一 atom 的身份判断

同一 atom 的判断只看语义身份，不看原始文案。

身份由现有 atomic semantics 已有字段确定，例如：

- `phase`
- `key`
- `sideScope`
- identity 相关核心 params
- `fieldPath / slot identity`

因此：

- “低买高卖”
- “逢低买入逢高卖出”
- “区间内自动来回买卖”

只要底层被归一到同一组 atomic semantics，就应被识别为同一组语义资产，而不是新的策略类型。

### 8.2 覆盖规则

1. **新一轮显式值覆盖旧值**
   用户本轮明确修改区间、步长、周期、方向、基准等字段时，更新对应 atom 或 slot。

2. **本轮未提及的旧 atom 默认保留**
   用户本轮只回答 `15m` 时，旧的网格相关 atoms 必须保留，只补 context/timeframe。

3. **旧值只能补缺，不能反向覆盖新显式值**
   merge 时旧 snapshot 只用于保真，不用于重新写回本轮显式修改。

### 8.3 Supersede 规则

当本轮消息与旧语义发生明确方向切换时：

- 旧 atoms 标记为 `superseded`
- 新 atoms 成为 active atoms

例如：

- 旧轮：网格语义
- 新轮：`不要网格了，改成布林带突破做空`

此时不允许把两者静默混合，也不允许保留旧网格 atoms 继续参与 clarification。

### 8.4 本轮解析变弱时的保护

这是本次设计的硬要求：

- 如果上轮 snapshot 已识别出更强的 active atoms
- 而本轮 `normalizer` 只识别出上下文、风险或更弱的语义结果

则 merge 后必须保留旧 active atoms。

不能因为本轮识别变弱，就把旧语义资产冲掉。

## 9. 闭合与未闭合语义

### 9.1 已闭合语义

已闭合语义指：

- atomic semantics 已识别完成
- 其影响执行一致性的 open slots 已全部关闭

要求：

- 后续补上下文、风险、仓位时，不得重复打开
- clarification 不得重新围绕这些语义追问

### 9.2 未完全闭合但方向明确的语义

这是本次设计必须覆盖的关键场景。

例如：

`帮我做一个网格策略，在一个区间内自动买卖，行情突破区间就停掉。`

该输入虽然缺少：

- 区间上下界
- 网格步长
- 市场上下文
- 主周期

但系统已经识别出：

- 区间约束下的自动买卖语义
- 存在突破区间即停掉的停止/失效语义

因此正确行为是：

- 保存已识别 atoms
- 为缺失字段保留 open slots
- 后续继续追问缺失槽位
- 不允许降级成 generic missing entry rule

### 9.3 clarification 来源

clarification 必须来自 merge 后 snapshot 中 active atoms 的 open slots，而不是 generic 文本缺口。

因此：

- 已有复杂语义方向时，问“还缺哪个参数/基准/确认方式”
- 没有任何复杂语义方向时，才允许回退到更 generic 的问题

## 10. 必须覆盖的情形

### 10.1 已识别复杂语义，仅补上下文

案例：

- 首轮识别网格
- 次轮只答 `15m`

要求：

- 旧网格 atoms 保留
- 只关闭 timeframe/context slot
- 不再问 generic entry rule

### 10.2 泛语义逐轮补全

案例：

- 首轮：`在一个区间内自动买卖，突破区间就停掉`
- 次轮：补区间
- 第三轮：补步长

要求：

- 每轮只关闭对应 open slots
- 已识别方向始终保留
- 不因参数未齐而丢失原有语义

### 10.3 已闭合后用户改口

案例：

- 已闭合网格
- 后续改为布林策略

要求：

- 旧 atoms `superseded`
- 新 atoms 激活
- clarification 只围绕新 active atoms

### 10.4 无关回答插入

案例：

- 当前在追问区间
- 用户先补 `单笔 10% 资金`

要求：

- 新增 risk / position atoms
- 原 open grid slots 保持 active
- 当前复杂语义不丢失

### 10.5 旧 session 兼容

案例：

- 老 session 没有该 snapshot 层

要求：

- 首次读取时可从现有 `semanticState` 或最新 normalizer 结果回填
- 不破坏历史会话读取

## 11. 还容易遗漏的情形

本次设计需明确考虑以下风险：

1. **用户只回答当前问题的一部分**
   只关闭对应 slot，其余继续保持 open。

2. **用户给出冲突参数**
   不得 silent merge，应显式覆盖或转为 supersede。

3. **同义改写**
   identity 不得依赖原文字符串。

4. **部分语义来自推断**
   必须保留 evidence/source，避免后续把系统推断误当用户明确承诺。

5. **多个复合逻辑并存**
   例如“网格 + 趋势门控 + 突破区间停掉”，不能假设一个策略只会落成单一模式。

6. **本轮 normalizer 识别弱于上轮**
   merge 必须 fail-closed：保留旧 active atoms。

## 12. 失败处理原则

1. merge 失败时，优先保留上轮已确认的 active atoms。
2. clarification 的 blocker 只能来自 merge 后 active open slots；若仍存在 open semantics，不允许回退为 generic missing entry rule。
3. 任何无法安全确认的覆盖，都应进入 `open/conflict` 状态并继续追问，而不是静默替换。
4. snapshot 更新必须尽量局部化，避免每轮全量重建造成身份漂移。

## 13. 服务职责建议

### 13.1 保留：`StrategyIntentNormalizerService`

继续负责：

- 将用户输入归一成现有 atomic semantics

### 13.2 新增或收敛：Snapshot Assembler / Merge Service

职责：

- 从当前 normalizer 结果组装 atomic snapshot patch
- 与 persisted snapshot 合并
- 维护 `open / locked / superseded`
- 输出下一轮 authoritative snapshot

### 13.3 clarification 侧调整

clarification 继续存在，但输入改为：

- merge 后 active atoms
- merge 后 open slots

而不是再从较弱的 fallback 结构重新判“缺入场规则”。

## 14. 测试计划

至少补以下测试：

1. 首轮识别网格，次轮只补 `15m`，不再追问 entry rule。
2. 泛语义网格逐轮补区间 / 步长，open slots 正常逐步闭合。
3. 已闭合网格后改为另一种策略，旧 atoms 被 `superseded`。
4. 本轮 normalizer 识别变弱时，旧 active atoms 仍保留。
5. 无关回答不会冲掉当前 open semantics。
6. 老 session 无 snapshot 时可平滑回填。

## 15. 风险与控制

### 15.1 主要风险

- 实现时偷偷回到“按策略 case 补 projection”
- 将 snapshot 做成只服务网格的隐性策略层
- 为了快，重新引入新的 `kind` 注册表
- 只保存闭合语义，忽略未闭合但方向明确的语义

### 15.2 控制策略

- 结构只允许复用现有 atomic semantics 通用形状
- 测试必须覆盖“部分闭合继续追问”而不是只覆盖闭合案例
- 明确禁止按策略类型做状态建模

## 16. 结论

本次设计的核心不是发明新的策略类型层，而是给现有 atomic semantics 一个正式的跨轮持久化快照层。

这层：

- 只解决“会话续聊时不丢语义”
- 同时覆盖已闭合与未闭合语义
- 不新增策略 `kind`
- 依赖现有 `normalizer` 原子语义
- 通过 merge 保证旧轮强语义不会被新轮弱结果冲掉

这样既能修复当前网格续聊回退 bug，也不会把系统重新收窄回模板化策略架构。
