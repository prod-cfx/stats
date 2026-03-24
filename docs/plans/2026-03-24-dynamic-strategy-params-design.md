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

## 11. 下一步

进入 `writing-plans`，产出可执行实施计划（文件级改动、测试矩阵、回滚策略）。
