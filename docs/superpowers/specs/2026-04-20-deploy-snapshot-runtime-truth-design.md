# 部署流程统一到 published snapshot 真相的设计方案

日期：2026-04-20  
Issue：#842  
范围：Deploy / Detail / Runtime / Signal

---

## 1. 背景

当前 AI Quant 在 deploy 阶段已经会按 `publishedSnapshotId` 读取快照中的正式部署真相，例如：
- exchange
- symbol
- marketType
- timeframe
- positionPct
- deployment execution defaults / constraints

详情页也已经通过统一的 detail 聚合接口展示 deploy 后的 snapshot truth。

但 deploy 后的 runtime / signal 生成链路还没有完整按 snapshot 中声明的执行语义运行。当前 runtime 可以消费“可重复评估的条件型语义”，例如价格涨跌、指标交叉、止损/止盈等；但对 `execution.on_start` 这类“生命周期 / 一次性执行语义”没有正式的状态模型，因此会出现：
- 发布成功
- 部署成功
- 详情页显示正常
- 但 signal runtime 不产出信号
- 日志落成 `SNAPSHOT_SCRIPT_NO_SIGNAL`

这说明当前系统已经具备：
- snapshot truth
- deploy 绑定
- detail 展示

但仍缺少：
- runtime 对 snapshot 生命周期语义的正式消费能力

---

## 2. 目标

建立一套长期有效的统一方案，使 deploy 后的运行行为和 published snapshot 中声明的执行语义保持一致。

核心目标：
1. `published snapshot` 是唯一执行语义真相。
2. deploy 不复制语义，不生成第二份执行语义副本。
3. runtime worker 直接读取 snapshot 执行。
4. 单独保存运行时状态，而不是把运行时状态混入 snapshot 或 deploy 语义副本。
5. 详情页必须明确展示运行时执行语义状态。

---

## 3. 非目标

本方案不处理以下事项：
1. 不改变“回测允许用户修改回测基础参数做实验”的产品形态。
2. 不在 deploy 阶段直接执行交易。
3. 不把 lifecycle / once 语义塞进 deploy DTO 的临时字段中。
4. 不依赖前端 UI 当前参数作为 deploy 后 runtime 的语义来源。
5. 不自动猜测旧实例的 lifecycle 语义。

---

## 4. 设计原则

### 4.1 Snapshot 是唯一语义真相
所有 deploy 后运行语义都必须从 published snapshot 读取，包括但不限于：
- market truth
- entry / exit / risk
- execution intent
- activation semantics
- fill timing
- once / repeat 规则

### 4.2 Deploy 只做绑定和状态初始化
Deploy 只负责：
- 绑定 `publishedSnapshotId`
- 记录 `snapshotHash`
- 初始化运行时执行状态

Deploy 不负责：
- 解释 snapshot
- 生成 signal
- 推导新的执行语义

### 4.3 Runtime worker 直接读取 snapshot
Worker 每次运行时：
- 先读取 instance 当前绑定的 snapshot
- 再读取 runtime state
- 根据 snapshot 真相 + runtime state 决定是否执行

### 4.4 运行时状态与语义真相分离
需要新增独立的运行时状态表，而不是：
- 把状态塞进 `strategy_instances.metadata`
- 把生命周期状态塞进 `strategy_signal_state`
- 让 snapshot 同时承担真相和可变状态

### 4.5 Fail-closed
如果 runtime 缺少合法的状态或 snapshot 绑定不一致：
- 不允许继续猜测执行
- 不自动回退到旧逻辑
- 要么停止执行，要么要求重新 deploy

---

## 5. 核心方案

采用：**独立 Runtime Execution State 方案**。

### 5.1 真相层
- `published snapshot`：唯一执行语义来源

### 5.2 状态层
新增表：`strategy_runtime_execution_states`

用途：
- 记录 deploy 后运行时执行状态
- 记录一次性 / 生命周期语义是否已消费
- 记录失败 / 冷却 / 已完成状态

它不是第二真相源，只是 snapshot 语义的执行状态投影。

---

## 6. 新增表设计

### 表名
`strategy_runtime_execution_states`

### 建议字段
- `id`
- `strategy_instance_id`
- `published_snapshot_id`
- `snapshot_hash`
- `execution_semantic_key`
- `status`
- `failure_reason`
- `failure_code`
- `last_attempt_at`
- `consumed_at`
- `cooldown_until`
- `created_at`
- `updated_at`

### 唯一约束
唯一键建议：
- `(strategy_instance_id, published_snapshot_id, execution_semantic_key)`

目的：
- 同一实例
- 同一快照
- 同一条一次性语义
只允许一条状态记录

### `execution_semantic_key` 约束
它必须是**语义索引键**，而不是执行语义副本。

例如：
- `on_start.entry.primary`
- `on_start.exit.bootstrap`

它只用于定位“这条语义的执行状态”，真正语义内容仍然来自 snapshot。

---

## 7. 状态机

### 状态值
第一阶段正式支持：
- `ready`
- `consumed`
- `failed`
- `cooldown`

保留但暂不主用：
- `pending`

### 流转规则
#### Deploy 成功后
- 如果 snapshot 中存在需要 runtime 消费的一次性 / 生命周期语义
- 初始化对应记录为 `ready`

#### Worker 执行成功
- `ready -> consumed`

#### Worker 执行失败（无有效 signal / 缺少执行条件）
- `ready -> failed`
- 记录 `failure_reason`
- 记录 `last_attempt_at`

#### 需要限流 / 避免高频重试时
- `failed -> cooldown`
- 记录 `cooldown_until`

#### 冷却结束后（如果产品允许再次尝试）
- `cooldown -> ready`

### 重新获得 once 资格的规则
仅在以下条件同时满足时：
- 新 snapshot（重新 publish）
- 新 deploy 成功

也就是说：
- 已 `consumed` 的语义不会被普通重试恢复
- 已失败的 once 语义不会因为页面刷新或 worker 重启就重新获得资格
- 必须重新 publish + 重新 deploy

---

## 8. Deploy 侧改造

### 当前保留
保留现有：
- `publishedSnapshotId` 校验
- snapshot truth 解析
- instance 创建 / 绑定
- `getStrategyDetail()` 统一回包

### 新增步骤
在 deploy 完成 instance 绑定后：
1. 读取 snapshot 中需要 runtime 消费的 lifecycle / once 语义
2. 生成对应的 `execution_semantic_key`
3. 初始化 `strategy_runtime_execution_states`

### 关键限制
Deploy：
- 不生成 signal
- 不执行 signal
- 不复制 execution 语义副本
- 只做状态初始化

---

## 9. Runtime Worker 侧改造

### 当前问题
`processPublishedSnapshotStrategyInstance()` 当前只会：
- 读取 snapshot
- 跑 snapshot script
- 如果没有得到 signal，就记 `SNAPSHOT_SCRIPT_NO_SIGNAL`

它缺少：
- 对 once / lifecycle 语义的消费状态判断

### 改造后流程
1. 读取当前 instance 绑定的 snapshot
2. 读取当前 snapshot 对应的 runtime execution state
3. 找到可执行的 `ready` 语义
4. 运行 snapshot script
5. 根据结果更新状态：
   - 有 signal：`consumed`
   - 无 signal：`failed` / `cooldown`

### 与 signal 落库的关系
首次激活产物仍然落成普通 `strategy_signal`，但其 metadata 增加：
- `activationSource = on_start`
- 可选：`executionSemanticKey`

这样可以复用现有：
- signal
- execution
- 审计
- 回放
- telemetry

---

## 10. Detail 聚合与详情页展示

### 后端 detail
`getStrategyDetail()` 新增聚合：
- 当前 instance 的 runtime execution states

新增 response 字段：
- `runtimeExecutionStates`

每项建议包含：
- `executionSemanticKey`
- `status`
- `failureReason`
- `lastAttemptAt`
- `consumedAt`
- `cooldownUntil`
- `publishedSnapshotId`
- `snapshotHash`

### 前端详情页
详情页新增区块：
- 运行时执行语义状态

展示内容示例：
- 绑定快照：`snapshot-xxx`
- 语义键：`on_start.entry.primary`
- 当前状态：`待执行 / 已执行 / 失败 / 冷却中`
- 最近尝试：时间
- 失败原因：`SNAPSHOT_SCRIPT_NO_SIGNAL`

目的：
- 把“deploy 成功但不产 signal”的黑盒问题显式化
- 让用户知道 deploy 后是否真的按 snapshot 进入运行态

---

## 11. 与当前 ORDIUSDT 案例的对应关系

### 当前现象
- 发布成功
- 部署成功
- 详情页显示正常
- 运行实例 `running`
- 手动 trigger 成功
- 但 signal 不落库
- 日志为 `SNAPSHOT_SCRIPT_NO_SIGNAL`

### 根因
`立即开始时市价买入` 被编译成 lifecycle / once 语义，但 runtime 目前只具备条件型语义的重复评估能力，没有 lifecycle / once 的正式状态模型。

### 新方案下
deploy 后会为该 instance 初始化：
- `execution_semantic_key = on_start.entry.primary`
- `status = ready`

worker 消费后：
- 成功 -> `consumed`
- 失败 -> `failed`

详情页中明确展示：
- 该语义已执行 / 未执行 / 失败
- 为什么失败

---

## 12. 兼容策略

### 新实例
- 新 publish
- 新 deploy
- 自动生成 runtime execution state

### 旧实例
不自动猜 once / lifecycle 语义。

对旧实例采用 fail-closed：
- 若缺少 runtime execution state
- 详情页显示需要重新 deploy 才启用统一执行语义

理由：
- 避免对旧策略做补丁式猜测
- 保持 snapshot truth 作为唯一语义来源

---

## 13. 方案收益

### 对用户
- deploy 成功后，不再黑盒
- 能看见“系统是否按策略声明开始执行”
- deploy truth 和 runtime truth 保持一致

### 对系统
- snapshot / state 分层明确
- 不再靠 deploy 或 runtime 猜用户意图
- 可以扩展更多 lifecycle / once 语义，而不是每次打补丁

### 对未来
这套方案可以自然扩展到：
- `on_start`
- `on_resume`
- `first_bar_open`
- `bar_close_once`
- 其他生命周期语义

前提是不改变原则：
- snapshot 保存语义
- runtime state 保存状态

---

## 14. 风险与控制

### 风险 1：状态表和实例绑定漂移
控制：
- 每次 worker 执行前校验 `snapshot_hash`
- 不一致则 fail-closed

### 风险 2：旧实例行为与新实例不一致
控制：
- 旧实例显式标记“需重新 deploy”
- 不自动迁移一次性语义

### 风险 3：状态机过复杂
控制：
- 第一阶段只正式支持 `ready / consumed / failed / cooldown`
- 先收住 `on_start` 这一类最明显的问题

---

## 15. 推荐结论

推荐采用：**B. 独立 Runtime Execution State 方案**。

最终原则：
- deploy 绑定 snapshot，不翻译 snapshot
- runtime worker 直接读 snapshot 真相
- runtime execution state 只保存执行状态，不保存语义副本
- 详情页明确展示 deploy 后的运行时执行语义状态
