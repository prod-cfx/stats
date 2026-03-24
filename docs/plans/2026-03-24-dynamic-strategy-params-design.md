# Dynamic Strategy Params Design

## 1. 背景与问题

当前 LLM 对话生成策略的参数是动态演进的，但前端参数展示仍写死为固定字段（交易所、交易对、单笔仓位等）。这会导致：

- 新策略参数无法自动展示与编辑
- 前后端参数语义漂移
- 列表/详情页展示与真实策略配置不一致

本次设计目标是建立「后端参数契约为单一事实来源」的动态参数体系。

## 2. 已确认决策

- 参数单一事实来源：后端
- 改造范围：AI 对话页参数面板 + 策略列表/详情动态展示
- 参数契约格式：JSON Schema
- 历史无 schema 策略处理：不兼容，直接提示“请重新生成”

## 3. 方案对比

### 方案 A（采用）

后端 JSON Schema 驱动 + 前端通用渲染器 + 历史无 schema 直接不可用。

优点：

- 真正单一事实来源
- 新参数扩展无需再改前端固定字段
- 消除双维护

代价：

- 需要后端一次性补齐 schema 输出
- 历史策略会被硬切

### 方案 B（不采用）

后端 JSON Schema + 前端 fallback 固定字段。

不采用原因：保留技术债，与“单一事实来源”冲突。

### 方案 C（不采用）

前端先做本地 schema 转换，后端再逐步收敛。

不采用原因：过渡期双轨太长，复杂度高。

## 4. 架构设计

### 4.1 参数契约

后端策略实例相关接口统一返回：

- `paramSchema`: JSON Schema
- `paramValues`: 当前参数值对象
- `schemaVersion`: 契约版本

要求：

- `paramValues` 必须可被 `paramSchema` 校验
- `schemaVersion` 用于缓存失效与排障定位

### 4.2 前端参数模型

- AI 对话页不再使用固定 `QuantParams` 作为唯一参数结构
- 改为通用对象模型：`Record<string, unknown>`
- 通过 `paramSchema` 动态渲染参数表单

### 4.3 页面改造边界

本次纳入：

- AI 对话参数面板动态化
- 策略列表页参数摘要动态化
- 策略详情页全量参数动态展示

本次不纳入：

- 部署弹窗全量重构
- 本地 mock/store 的全面动态化

## 5. 数据流设计

### 5.1 AI 对话页

1. 进入会话/切换会话，拉取策略上下文。  
2. 读取 `paramSchema + paramValues` 初始化动态表单。  
3. 用户修改参数后，仅提交 `paramValues`（不拼固定字段）。  
4. codegen checklist 继续使用 `symbols/timeframes/riskRules`，但由统一 adapter 从 `paramValues` 派生。  

### 5.2 列表/详情展示

- 列表：仅展示 schema 标记为摘要的参数（如 `x-display: summary`）
- 详情：按 schema 顺序展示全量参数（类型感知格式化）

## 6. 兼容与迁移策略

- 缺失 `paramSchema`：直接显示“该策略版本不受支持，请重新生成”
- `schemaVersion` 变化：强制刷新会话参数缓存
- 不提供旧字段 fallback，避免继续固化历史模型

## 7. 错误处理

- schema 拉取失败：进入可重试错误态，阻断生成
- schema 校验失败：字段级提示，禁止提交
- checklist 派生失败：返回明确字段键名和失败原因

## 8. 测试设计（需求驱动）

### 8.1 Happy Path

- 动态 schema 渲染、编辑、提交成功
- 列表与详情正确回显动态参数

### 8.2 Edge Cases

- 空 schema / 字段数量较多
- enum、required、number 边界（min/max）

### 8.3 Error Handling

- schema 非法
- `paramValues` 类型不匹配
- 历史策略无 schema

### 8.4 状态流

- 会话切换
- schemaVersion 变更触发缓存失效与重建

## 9. 交付清单

### 后端

- 策略实例/详情接口补齐：`paramSchema`、`paramValues`、`schemaVersion`

### 前端

- 通用参数渲染器（编辑 + 只读）
- codegen 参数派生 adapter（集中映射）
- 列表/详情动态参数展示改造

## 10. 风险

- 硬切历史策略会产生用户感知断层
- schema 设计若不稳定，会导致前端渲染频繁变更
- adapter 规则不清晰会影响 codegen 一致性

## 11. 实现状态（Task 6）

### 11.1 已完成任务

- Task 1（后端 DTO 契约扩展）已完成：`paramSchema` / `paramValues` / `schemaVersion` 已进入 account-strategy-view DTO。
- Task 2（后端聚合与返回）已完成：account-strategy-view 服务层已组装并返回动态参数契约。
- Task 3（前端 AI 对话参数动态化）已完成：AI Quant 会话参数改为 schema 驱动并移除固定字段依赖。
- Task 4（前端列表/详情动态展示）已完成：账户策略列表与详情已切换为动态参数展示并带历史无 schema 保护。
- Task 5（前端参数校验闸门）已完成：提交前 schema 校验闸门与嵌套对象检查已补齐。
- Task 6（集成验证与文档回填）已完成：完成本节验证记录与风险归档。

### 11.2 关键提交

- `e1b088fc`: `feat(quantify): extend account strategy view dto dynamic params contract`
- `e6616353`: `feat(quantify): assemble dynamic param schema in account strategy view`
- `f8bc81a9`: `feat(front): switch ai-quant chat params to schema-driven`
- `02f0ab1d`: `feat(front): dynamic strategy params in account list/detail with legacy guard`
- `82ce4842`: `fix(front): refine task5 validation gating and nested object checks`

### 11.3 验证证据（2026-03-24）

- Quantify account-strategy-view（unit）  
  命令：`cd apps/quantify && pnpm run test:unit -- account-strategy-view`  
  结果：`6` suites，`4` passed，`2` failed；`21` tests，`18` passed，`3` failed。  
  失败要点：  
  1) `account-strategy-view.action.spec.ts` 仍断言旧错误文案，实际为错误码 `account_strategy.owner_only`。  
  2) `account-strategy-view.controller.spec.ts` 缺少 transactional host 初始化，触发 `TransactionHost not initialized`。

- Quantify account-strategy-view（e2e 定向）  
  命令：`cd apps/quantify && pnpm run test:e2e:file -- e2e/account-strategy-view/account-strategy-view.e2e-spec.ts`  
  结果：未进入用例执行（`0` tests）；环境阻塞失败。  
  失败要点：`DATABASE_URL` 缺失，`setup-e2e.ts` 触发 `process.exit(1)`。

- Front account 组件测试  
  命令：`cd apps/front && npx vitest run src/components/account/*.test.ts src/components/account/*.test.tsx`  
  结果：`6` files failed，`0` tests executed。  
  失败要点：测试文件使用 Jest 风格（含 `@jest/globals` / 全局 `describe`），当前以 Vitest 直接运行无法加载该运行时。

- Front ai-quant session-loop + dynamic-params  
  命令：`cd apps/front && npx vitest run src/components/ai-quant/session-loop.test.ts src/components/ai-quant/dynamic-params.test.ts`  
  结果：`2` files failed，`0` tests executed。  
  失败要点：同样依赖 `@jest/globals`，Vitest 运行时无法解析。

- Front type-check  
  命令：`pnpm --filter @ai/front run type-check`  
  结果：失败（`tsc` exit code `2`），存在既有类型问题阻塞。  
  代表性问题：  
  1) `src/components/account/dynamic-param-summary.ts`：`object` 类型访问 `title` 报错。  
  2) `src/components/trading/RightPanel/RightPanel.tsx`、`src/lib/hyperliquid-api.ts`：`@ai/shared` 类型声明缺失。  
  3) `src/lib/api.ts` 多处分页返回与数组类型不匹配。

### 11.4 已知残余风险

- 测试基建分裂风险：前端账户/AI Quant 测试文件仍偏 Jest 写法，但验证阶段按 Vitest 运行会整体失败，CI/本地结果解释成本高。
- 后端回归门禁风险：account-strategy-view 关键单测仍有断言与事务初始化问题，现阶段无法作为稳定回归门禁。
- E2E 环境风险：`DATABASE_URL` 依赖未满足时，account-strategy-view e2e 无法执行，动态参数链路缺少端到端验证闭环。
