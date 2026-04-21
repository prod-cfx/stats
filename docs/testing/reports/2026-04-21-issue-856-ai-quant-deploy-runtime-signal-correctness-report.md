# Issue 856 — AI Quant deploy/runtime/signal correctness 验证报告

日期：2026-04-21  
环境：staging + 本地实现分支 `codex/fix/856-deploy-runtime-signal-correctness`

---

## 1. 本地实现验证状态

当前分支已完成以下实现阶段并通过对应本地验证：

### Task 1 — publish truth 结构化
- 将 `runtimeExecutionSemantics` 固化为 canonical structured truth（`semanticKey`）
- 下游 runtime consumer 仅消费 canonical 结构并对旧 shape fail-closed
- 验证：targeted Jest / TS diagnostics 通过

### Task 2 — deploy binding + runtime execution state model
- 将 runtime execution state 收紧为 projection model
- 引入 `ready / running / retryable / terminal / consumed`
- deploy 对缺失或 legacy runtime truth 的 snapshot fail-closed
- 验证：targeted Jest / Prisma generate / TS diagnostics 通过

### Task 3 — runtime 四阶段执行与分层归因
- published snapshot runtime path 改为 binding → activation → execution → consumed
- activation 缺失不再误记为 no-signal
- execution 真无信号与 unexpected error 分开归因
- 验证：targeted Jest / TS diagnostics 通过

### Task 4 — detail / contract / front 分层展示
- `failureFamily` 贯通 quantify DTO → generated contract → front api/store/adapter/detail
- 仅 execution-family no-signal 渲染为 `未生成可执行信号`
- binding / activation 渲染为更准确文案
- 验证：
  - quantify detail spec 通过
  - front targeted Jest 通过
  - backend contract spec 通过
  - generated quantify contract TS diagnostics 通过

---

## 2. staging 无头浏览复现结果

### 2.1 登录与导航
- 登录页：`https://cfx-www-staging.devbase.cloud/zh/auth/login`
- 测试账号：`1512627988@qq.com`
- 固定验证码：`123456`
- 登录成功后默认落点：`https://cfx-www-staging.devbase.cloud/zh/account`
- 手动跳转 AI Quant：`https://cfx-www-staging.devbase.cloud/zh/ai-quant`

### 2.2 提交目标策略
提交自然语言策略：

> 在 OKX 现货 ORDIUSDT 上，主周期 1h，使用 10% 固定仓位只做多；入场动作为立即开始时市价买入；出场规则为价格相对前收盘上涨 1% 时卖出，另有相对入场均价下跌 5% 止损卖出、相对入场均价上涨 10% 止盈卖出。

### 2.3 页面表现
页面返回错误：

- `LLM 策略生成请求失败 (INTERNAL_SERVER_ERROR, HTTP 500, requestId 54c3e04e-48ee-43eb-9c7f-a7314069e1d7)`

### 2.4 抓到的关键接口
- `POST https://cfx-backend-staging.devbase.cloud/api/v1/llm-strategy-codegen/sessions`
- 响应状态：`500`

结论：当前 staging 在 **codegen session 创建阶段后半段** 就已经失败，尚未走到 deploy / signal 验证阶段。

---

## 3. staging 数据库核验

### 3.1 llm_strategy_codegen_sessions
针对本次无头浏览触发出的最新 session：

- `id = cmo8w3fdrfsjcy2qsrd25gwfi`
- `user_id = cmn5k086200021jqsntsla6no`
- `status = CONFIRM_GATE`
- `reject_reason = null`
- `has_clarification = true`
- `has_semantic = true`
- `has_spec_desc = true`
- `has_graph_snapshot = false`
- `has_semantic_graph = false`
- `has_validation_report = false`
- `has_compiled_ir = false`
- `created_at = 2026-04-21 17:20:23.199`
- `updated_at = 2026-04-21 17:20:23.199`

### 3.2 ai_quant_conversations
对于 `codegen_session_id = cmo8w3fdrfsjcy2qsrd25gwfi`：

- 查询结果：**0 rows**

### 3.3 published_strategy_snapshots
对于 `session_id = cmo8w3fdrfsjcy2qsrd25gwfi`：

- 查询结果：**0 rows**

---

## 4. 证据结论

这次 staging 现状可以明确得出：

1. 浏览器侧看到的 500 不是“请求完全没进后端”。
2. `llm_strategy_codegen_sessions` 已成功落库，并且状态已经推进到 `CONFIRM_GATE`。
3. 但是对应的：
   - `ai_quant_conversations` 没有创建
   - `published_strategy_snapshots` 没有创建
4. 因此当前线上故障点更靠前，位于：
   - **codegen session 创建后的 conversation / response 组装链路**
   - 而不是 deploy runtime 本身

换句话说：

> 当前 staging 的首个阻断点，是“codegen session 已创建，但接口仍返回 500，且 conversation/snapshot 未完成落库”。

所以在当前线上环境里，尚不能继续完成 deploy → runtime signal 的真实线上闭环验证，因为还没稳定走到 publish 完成那一步。

---

## 5. 对 issue 856 的影响判断

- 本地分支上的修复工作（publish truth / deploy binding / runtime phase / detail failure family）仍然是必要的。
- 但 **当前 staging 线上验证被一个更前置的 500 阻断**。
- 在修复代码真正部署到 staging 前，无法用线上环境证明 deploy/runtime 侧修复已经生效。

因此，Issue 856 当前验证结论应分成两层：

### 本地代码层
- 修复链路已经走到 Task 4，并完成针对性本地验证。

### staging 线上层
- 被 `POST /api/v1/llm-strategy-codegen/sessions` 的 500 阻断。
- 需要先解决或绕开这个 500，才可继续进行 publish → deploy → signal 的线上闭环确认。

---

## 6. 后续建议

1. 优先排查 staging 上 `llm-strategy-codegen/sessions` 这条 500 的具体后端异常栈。
2. 重点查看：
   - session 创建后到 conversation 创建之间的代码路径
   - response mapper / conversation persistence / title generation 相关逻辑
3. 待 staging 能稳定完成 codegen session + conversation + publish 后：
   - 再复跑本次 ORDIUSDT 用例
   - 继续验证 deploy 详情页是否仍落成错误的 `未生成可执行信号`
4. 若届时 deploy/runtime 仍有问题，再用本分支修复后的逻辑对照数据库和 UI 进行最终确认。
