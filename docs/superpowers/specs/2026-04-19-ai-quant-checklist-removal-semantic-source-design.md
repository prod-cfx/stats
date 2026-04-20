# AI Quant Checklist Removal Semantic Source Design

日期：2026-04-19

状态：设计已确认，待写实施计划

## 1. 背景

当前 AI Quant 主链路已经从 checklist 时代迁移出一大半，但系统仍处在半迁移状态。

当前真实主链可概括为：

`用户消息 -> checklist patch / planner logic patch -> semanticState -> normalizedIntent (+ compatibility checklist projection) -> canonicalSpec -> digest -> confirmGenerate -> publication -> IR -> AST -> compiled script -> consistency -> published snapshot`

近期已经做过多轮语义保真收敛，尤其是：

- 原子语义与 `semanticState` 的细粒度 contract 已经成为核心能力
- 语义层支持更细粒度 slot，例如 confirmation、basis、sideScope、positionMode 等
- publication fidelity 已经开始约束发布阶段不得任意改义
- 前端 `confirmGenerate` 已基本停止回传旧 checklist 结构

但 checklist 仍以两种残留形态存在：

1. 首轮入口与 continueSession 编排仍会产生或消费 checklist patch
2. `normalizedIntent -> canonicalSpec` 之间仍夹着 compatibility checklist projection

这导致系统依然保留 checklist-era 过渡层，带来两个结构性问题：

- 已经确认的 atomic semantics 仍可能在中间层被回投、降维、或重新解释
- LLM 提示词、会话 gate、前后端协议、数据库结构仍然存在 checklist 时代的语言和接口残影

本次设计的目标不是重画数据流，也不是重写 atomic semantics contract，而是在保留现有语义主链、语义保真机制和细粒度追问能力的前提下，彻底删除 checklist 过渡层，让 atomic semantics / `semanticState` 成为唯一真相源。

## 2. 问题定义

本次要解决的不是“某个策略模板识别不准”，而是：

`checklist` 仍然作为半迁移时代的中间产物插在会话入口、确认前整理、以及 canonical 构建前的关键位置，导致语义真相源不够纯。

当前 checklist 的残留问题主要有四类：

### 2.1 入口真相源不纯

首轮消息与续聊消息仍可能先产出 checklist patch，再 merge 到 `semanticState`。

这意味着：

- 模型在入口层仍有机会使用 checklist-era 结构表达理解结果
- 代码里仍需要 checklist patch 到 semantic patch 的隐式翻译
- atomic semantics 已经足够细，但入口仍被旧结构拖拽

### 2.2 canonical 前仍存在 compatibility checklist projection

当前链路中：

- `semanticState` 会先构造 `normalizedIntent`
- 之后仍可能经过 compatibility checklist projection
- 再进入 `canonicalSpec`

这让 canonical 构建前仍存在一次语义回投，违背“atomic semantics 直接驱动 canonical”的目标。

### 2.3 gate 与提示词仍带 checklist-era 语言

尽管 clarification 已具备细粒度 slot 能力，但系统中仍有不少判断和提示以 checklist field 语言组织，例如：

- 缺 entryRules / exitRules / riskRules
- 从 checklist 缺字段推导 blocker
- 让 prompt 继续输出 checklist patch 或 checklist 风格总结

这会把已经细化的 atomic semantics contract 再次压回旧语义粒度。

### 2.4 跨层协议仍保留 checklist-era 心智

即使运行主链逐步减少 checklist 参与，以下层面仍可能残留 checklist 结构：

- `apps/front` 本地 preflight / session-loop / confirm 请求准备
- `apps/quantify` DTO、service、repository、session persistence
- quantify 侧 Prisma schema 与数据库字段
- 测试 fixture、helper、prompt contract

如果这些残影不一起清理，系统会继续维持“代码逻辑上想 single source，协议和存储上仍是双轨”的半迁移状态。

## 3. 目标与非目标

## 3.1 目标

本次设计目标如下：

1. 保留现有主数据流节点与顺序，不重画系统主流程
2. 删除 `checklist patch`，改为直接产出 semantic patch / planner logic patch 并 merge 到 `semanticState`
3. 删除 `compatibility checklist projection`，使 `normalizedIntent` 直接进入 `canonicalSpec`
4. 保留并强化当前 atomic semantics 的细粒度 contract 与更细追问能力
5. 保留现有 digest / confirmGenerate / publication / consistency / published snapshot 主链
6. 让 `apps/front`、`apps/quantify`、quantify 侧 Prisma/数据库、LLM 提示词同步升级到 semantic-era 协议
7. 先在独立分支上完成完整联调验证，验证成功后作为一套协调升级整体合入 `main`

## 3.2 非目标

本次明确不做：

- 不重写主数据流节点顺序
- 不重写 atomic semantics 数据模型
- 不削弱 confirmation、basis、sideScope、positionMode 等细粒度 contract
- 不把系统改成另一套全新的 projector/compiler 架构
- 不为兼容历史 checklist 会话保留长期双轨运行方案
- 不要求与当前半迁移态长期共存；若方案验证成功，应以同一批前端、`apps/quantify`、Prisma/数据库、prompt、tests 的协调升级整体落入 `main`

## 4. 方案比较

### 4.1 方案 A：只删 publication 内的 checklist projection

做法：

- 保留会话期 checklist patch
- 仅删除 publication 生成阶段的 compatibility checklist projection

优点：

- 改动最小
- 对发布链路见效快

缺点：

- 入口真相源仍不纯
- prompt 和 clarification 仍是 checklist-era 语言
- 系统仍然处于半迁移状态

结论：

- 不采用

### 4.2 方案 B：两阶段删除，但在同一分支内完成全链路切换并以整体合入 `main` 为目标

做法：

- 阶段 1：让运行主链完全摆脱 checklist，但允许少量结构壳暂时存在
- 阶段 2：在同一分支里删除所有 checklist 相关类型、字段、adapter、测试夹具和数据库结构

优点：

- 最符合本次目标：大手术，但联调可控，且最终可以作为一套完整升级落到 `main`
- 出问题时能区分“主链切换问题”与“结构清理问题”
- 最终结果仍是 checklist 全删

缺点：

- 实施过程比“一刀删完”多一个中间清场步骤

结论：

- 采用

### 4.3 方案 C：一步到位同时删除代码与结构

做法：

- 一次提交内同时删除 checklist 运行逻辑、协议、数据库、测试夹具

优点：

- 结果最干净

缺点：

- 爆炸半径太大
- 任何一层漏改都会让联调排查成本飙升
- 不利于在分支上稳妥验证，也不利于形成可审查、可整体合并的迁移过程

结论：

- 不采用

## 5. 设计原则

### 5.1 不改主数据流，只替换真相源

当前链路：

`用户消息 -> checklist patch / planner logic patch -> semanticState -> normalizedIntent (+ compatibility checklist projection) -> canonicalSpec -> digest -> confirmGenerate -> publication -> IR -> AST -> compiled script -> consistency -> published snapshot`

目标链路：

`用户消息 -> semantic patch / planner logic patch -> semanticState -> normalizedIntent -> canonicalSpec -> digest -> confirmGenerate -> publication -> IR -> AST -> compiled script -> consistency -> published snapshot`

变化只允许发生在：

- `checklist patch` 删除
- `compatibility checklist projection` 删除

其它节点顺序、含义、护栏都保持不变。

### 5.2 atomic semantics 是唯一真相源

`semanticState` 必须成为以下能力的唯一输入来源：

- 当前理解 summary
- clarification blocker 与下一问
- normalizedIntent
- canonicalSpec
- digest
- confirmGenerate
- publication

任何需要“看策略当前语义”的地方，都不得再读 checklist-era 结构。

### 5.3 保留细粒度 contract

下列 contract 必须继续保留并作为主链核心能力：

- confirmation
- basis
- sideScope
- positionMode
- open semantic slots
- finer-grained semantic evidence

删除 checklist 不能以“退回粗粒度规则文本”为代价。

### 5.4 提示词也必须切到 semantic-era

如果代码层删除 checklist，但 LLM 仍被要求产出 checklist patch 或 checklist 风格总结，系统会在入口再次回退。

因此 prompt contract 必须与新的 semantic-only 主链同步收敛。

### 5.5 跨层一致升级

本次不是单点改造，而是跨层收敛：

- `apps/front`
- `apps/quantify`
- quantify 侧 Prisma 与数据库
- prompt
- tests

这几层必须一起升级到 semantic-era 协议，不能再保留 checklist 适配层。

## 6. 模块边界与职责

## 6.1 保留并继续承担主职责的模块

### `apps/quantify` 中的 semantic extraction / reducer

职责保持不变：

- 从用户消息中抽取 atomic semantics
- 产出 semantic patch / planner logic patch
- merge 到 `semanticState`
- 保留 slot、evidence、sideScope、basis、confirmation、positionMode 等细粒度状态

要求：

- 不再产出 checklist patch
- 不再依赖 checklist 字段做状态承接

### `apps/quantify` 中的 clarification rules / question service

职责保持不变，但输入源切换为纯 `semanticState`：

- blocker 判断看 semantic slots 是否闭合
- question 排序看 semantic priority
- 提示文案围绕 atomic semantics contract 展开

禁止：

- 用 checklist field completeness 驱动 gate
- 继续以 `entryRules / exitRules / riskRules` 缺失作为主要 blocker 表达

### `apps/quantify` 中的 normalizedIntent / canonical builder

职责保持，但上游输入收敛：

- `semanticState -> normalizedIntent`
- `normalizedIntent -> canonicalSpec`

禁止：

- `semanticState -> compatibility checklist projection -> canonicalSpec`
- `checklist -> canonicalSpec`
- 从 checklist 文本再猜一遍语义

### `apps/quantify` 中的 publication pipeline

publication 节点顺序保持不变：

`canonicalSpec -> IR -> AST -> compiled script -> consistency -> published snapshot`

只替换入口真相源：

- publication 的 canonical 输入必须来自 `semanticState` 驱动的链路
- 不得再经过 checklist-era adapter

### `apps/front`

前端职责保持在展示与确认：

- 渲染 semantic-derived logic view / specDesc / digest
- 发送消息、clarification answers、confirm digest
- 接受后端返回的 semantic-era session 状态

禁止：

- graph -> checklist
- specDesc -> checklist
- confirm 前本地构造 checklist payload

## 6.2 明确要删除的层

以下 checklist-era 结构必须删除：

1. `ChecklistPayload` 作为运行主链状态
2. `checklist patch` 作为入口抽取产物
3. `compatibility checklist projection`
4. 前端任何 checklist rebuild 逻辑
5. DTO、Prisma、数据库中所有仍表达“checklist 是真相源”的结构
6. prompt 中任何要求模型输出 checklist patch 的 contract

## 7. 两阶段落地策略

## 7.1 阶段 1：运行主链切换

目标：

- 让运行时主链完全摆脱 checklist
- 让联调链路在 semantic-only 前提下跑通

### 范围

#### `apps/quantify`

- 首轮入口与 continueSession 编排不再产出/消费 checklist patch
- clarification / summary / compileability / digest / confirm state 全部切到 semanticState
- normalizedIntent 不再依赖 compatibility checklist projection
- publication generation stage 不再调用 semantic-to-checklist adapter
- prompt contract 改成 semantic patch / semantic slot 语言

#### `apps/front`

- 删除 confirm preflight 中 checklist-era 组装逻辑
- 删除 `resolveChecklistPayload` 以及 graph/specDesc/checklist 回推路径
- 会话本地状态只保留 semantic-era 数据

#### DTO / API

- API 允许暂时保留 checklist-era 字段壳，但运行逻辑不得再读取
- 前端请求不再发送 checklist 结构化载荷

### 阶段 1 验收标准

1. `startSession -> drafting -> clarification -> confirmGenerate -> publication` 可完整跑通
2. 运行主链中不再读取 checklist / compatibility checklist projection
3. LLM 提示词不再生成 checklist patch
4. 前端确认请求不再发送任何 checklist 结构

## 7.2 阶段 2：结构删除与清场

目标：

- 删除所有 checklist-era 死代码、协议、数据库结构和测试夹具

### 范围

#### `apps/quantify`

- 删除 checklist types、adapter、builder、repository 字段、service helper
- 删除所有仅用于 checklist-era 的 prompt helper

#### `apps/front`

- 删除 checklist-era helper、tests、fixture、state 字段

#### Prisma / 数据库

- 修改 quantify 侧 Prisma schema
- 生成 migration
- 删除 checklist-era session persistence 字段
- 调整 repository、mock、fixture

#### 测试与文档

- 删除 checklist-era fixtures / helpers / spec 断言
- 更新文档中所有 checklist-era 描述

### 阶段 2 验收标准

1. 仓库中不再存在 AI Quant 主链使用的 checklist 结构
2. quantify 侧 Prisma schema 与数据库不再持久化 checklist-era 状态
3. 前后端测试与 fixture 全部切到 semantic-era

## 8. LLM 提示词升级要求

## 8.1 planner / extraction prompt

必须从 checklist patch contract 升级为 semantic patch contract。

只允许输出：

- semantic patch
- planner logic patch（若其本身为 semantic/planning 结构）
- clarification intent

不再允许输出：

- checklist patch
- checklist field patch
- checklist 风格的缺字段清单

## 8.2 clarification prompt

clarification prompt 必须围绕 atomic semantic slots 工作：

- 哪个 slot 仍 open
- 该 slot 对执行语义有何影响
- 当前需要用户补充的最小信息是什么

问题粒度继续保持细化能力，例如：

- 触及还是收盘确认
- 止损 basis 是什么
- sideScope 是 long、short 还是 both

## 8.3 summary / confirmation prompt

summary、logic view、confirmation prompt 必须引用 semantic truth：

- `semanticState`
- semantic-derived `normalizedIntent`
- semantic-derived `canonicalSpec`

禁止再让模型从 checklist projection 总结策略。

## 9. 前端 / Quantify / Prisma / 数据库升级范围

## 9.1 `apps/front`

需要同步升级：

- session local state
- confirm preflight
- message continue payload
- logic view / digest consumption
- checklist-era tests 与 fixtures

目标是让前端完全理解 semantic-era 协议，而不是继续扮演 checklist 适配器。

## 9.2 `apps/quantify`

这是本次真实核心改造位点，需要覆盖：

- conversation orchestration
- clarification gate
- semantic reducer
- normalizedIntent builder
- canonical builder
- publication generation stage
- prompt contract
- session persistence

`apps/quantify` 是 AI Quant 主链的真实服务端，本次设计中的“服务端升级”默认都以这里为主。

## 9.3 `apps/backend`

若以下内容受影响，再做配套调整：

- API contract
- OpenAPI
- 前端代理接口
- 外部聚合入口

但它不是本次 semantic 主链删除 checklist 的核心实现位点。

## 9.4 quantify 侧 Prisma / 数据库

需要同步升级：

- schema
- migration
- repository
- fixture
- mock

要求数据库层也与新的 semantic-only 真相源一致，不再保留 checklist-era 主链字段。

## 10. 风险与验证

## 10.1 最大风险点

### 风险 1：入口仍偷偷产出 checklist patch

如果入口仍存在 checklist patch，即使 publication 已切干净，系统也仍是半迁移。

### 风险 2：clarification gate 退化

如果 gate 还按 checklist field completeness 工作，会出现：

- 语义已识别
- 但 blocker 表达和提示词仍是旧世界

### 风险 3：前端/数据库协议未同步

如果 `apps/front` 或 Prisma/DB 仍保留 checklist-era 心智，联调时会出现“后端 single source，边缘层双轨”的新问题。

### 风险 4：prompt 仍说 checklist 语言

这会让入口模型继续往旧结构回退。

## 10.2 验证策略

按链路分四层验证：

1. 会话层
  验证 start / continue 只通过 semantic patch + semanticState 演进
2. gate 层
  验证 clarification / digest / confirmGenerate 全基于 semanticState
3. 发布层
  验证 publication generation stage 不再经过 checklist projection
4. 黄金用例
  至少覆盖：
  - Bollinger 双向开仓 + 中轨分向平仓
  - Grid range rebalance
  - 一个带细粒度 basis / confirmation 的策略

## 10.3 分支联调与合并验收标准

分支是否允许进入合并评估并整体合入 `main`，只看以下五条：

1. `start -> drafting -> clarification -> confirm -> publish` 全链路跑通
2. 运行主链中不再读取 checklist / compatibility checklist projection
3. Bollinger / Grid / 百分比 basis 三类黄金回归通过
4. 前端确认请求不再发送 checklist 结构
5. published snapshot 与 compiled script 的一致性门保持通过

## 11. 实施结论

本次实施采用“同一分支内两阶段完成”的策略：

- 阶段 1：先完成 semantic-only 运行主链切换
- 阶段 2：再完成 checklist-era 结构删除与 Prisma/数据库清场

最终目标不是“弱化 checklist 依赖”，而是：

`在不改现有语义主数据流、不削弱细粒度 atomic semantics contract 的前提下，彻底删除 checklist 过渡层，让 atomic semantics / semanticState 成为 AI Quant 的唯一真相源。`
