# Strategy Plaza Public Beta Design

日期：2026-04-24

状态：Approved design, pending implementation plan

范围：AI Quant 策略广场对外公测版；官方策略模板展示、运行、编辑；OKX 模拟交易部署闭环。

---

## 1. 背景

当前 AI Quant 已经打通“对话生成策略 -> 回测 -> 部署”的主链路，但策略广场仍主要依赖前端 mock preset 和展示数据。公测版需要让用户看到 6 个常见量化策略，并能直接运行或进入 AI 对话编辑。

本设计把策略广场定义为“官方可运行策略包”，由后端提供模板真相和运行入口，前端不再把 mock preset 当作可运行策略来源。

---

## 2. 目标

1. 策略广场展示 6 个官方公测策略。
2. 未登录用户可以浏览策略，但点击运行或编辑时进入现有登录流程。
3. 登录用户点击“运行”后，只要已绑定 OKX 模拟交易 API Key，就直接部署为自己的 running 策略。
4. 登录用户点击“编辑”后，进入 AI Quant 对话，并以官方模板作为初始语义种子，后续流程与普通用户生成策略一致。
5. 前端不再展示伪装成真实表现的 mock 收益率和胜率。
6. 运行入口不允许用户覆盖市场类型、标的、仓位、杠杆等官方模板固定参数。

---

## 3. 非目标

1. 不设计内测码登录机制。本设计假设登录成功用户已经通过准入。
2. 不接真实盘，只支持 OKX 模拟交易 API Key。
3. 不做复杂组合策略。
4. 不把旧 `ops/strategy-templates` 管理接口直接暴露为用户侧策略广场接口。
5. 不在“运行”入口提供参数编辑表单。
6. 不新增独立 DSL 编辑器。

---

## 4. 官方策略集合

首批固定 6 个策略：

1. `ma-cross`：MA 均线交叉，趋势跟随。
2. `bollinger-reversion`：布林带均值回归。
3. `grid-range`：网格区间震荡。
4. `rsi-reversal`：RSI 超买超卖。
5. `breakout-follow`：突破追踪。
6. `macd-cross`：MACD 金叉死叉。

每个策略模板固定包含：

- 模板 ID、名称、说明、标签、风险等级、适用行情。
- OKX 市场类型：现货或永续。
- 标的、周期、仓位、杠杆、默认风控。
- 可运行 published snapshot 或等价的官方发布真相。
- 编辑用 prompt / semantic seed。
- 展示摘要，不包含用户可覆盖的运行参数。

市场采用混合策略：保守/单向策略可跑 OKX 模拟现货，趋势/突破/多空策略可跑 OKX 模拟永续。无论现货还是永续，都只允许 OKX 模拟交易 API Key。

---

## 5. 推荐架构

采用独立用户侧 `strategy-plaza` 模块，而不是继续前端 mock，也不直接复用 ops 模板接口。

理由：

1. 策略广场是用户产品能力，应该有稳定公开 API。
2. “运行”需要消费 AI Quant published snapshot 真相，与旧策略模板脚本生成语义不同。
3. 独立模块可以清晰表达官方模板、运行幂等、OKX 模拟交易约束。
4. 未来可扩展模板状态、排序、灰度、指标说明，而不污染 AI 对话主链路。

---

## 6. 后端 API

新增用户侧接口：

```text
GET  /strategy-plaza/templates
GET  /strategy-plaza/templates/:id
POST /strategy-plaza/templates/:id/run
POST /strategy-plaza/templates/:id/edit-session
```

### 6.1 模板列表

`GET /strategy-plaza/templates` 返回可展示模板列表。未登录也可访问。

返回字段包括：

- `id`
- `name`
- `description`
- `tags`
- `riskLevel`
- `marketType`
- `symbol`
- `timeframe`
- `positionPct`
- `leverage`
- `scenario`
- `status`
- `displayMetrics`

`displayMetrics` 如包含收益率、胜率，必须标记为官方示例或样例回测指标，不得表达为用户真实收益。

### 6.2 模板详情

`GET /strategy-plaza/templates/:id` 返回策略详情和完整展示摘要。未登录也可访问。

详情必须包含：

- 策略逻辑说明。
- 运行摘要。
- 风险提示。
- 编辑入口所需的非敏感 seed 摘要。

### 6.3 运行模板

`POST /strategy-plaza/templates/:id/run` 需要登录。

请求体只接受：

```ts
interface RunStrategyPlazaTemplateRequest {
  runRequestId: string
}
```

不接受 market、symbol、positionPct、leverage、timeframe 等覆盖字段。

服务端流程：

1. 解析当前用户。
2. 读取官方模板并确认 `status = live`。
3. 校验模板只使用 OKX。
4. 查询用户可用 OKX 模拟交易 API Key。
5. 若没有可用 API Key，返回明确错误码供前端跳绑定页。
6. 使用模板固定 published snapshot / 运行真相创建用户策略实例。
7. 使用 `runRequestId` 做幂等，重复请求返回同一部署结果。
8. 策略部署为 `running`，运行环境为 OKX 模拟交易。

成功响应返回用户策略详情，以及前端跳转策略详情页所需的 `strategyId`、`status`、`deployRequestId`。

### 6.4 编辑模板

`POST /strategy-plaza/templates/:id/edit-session` 需要登录。

服务端流程：

1. 读取官方模板。
2. 创建或启动 AI Quant codegen session。
3. 将模板的 prompt / semantic seed 作为初始上下文。
4. 返回 session 信息和前端可跳转的上下文。

编辑后续走现有普通用户生成策略流程：对话、确认、发布、回测、部署。

---

## 7. 前端交互

### 7.1 策略广场展示

`StrategyPlaza` 从本地 `STRATEGY_PRESETS` 改为消费后端 `strategy-plaza` API。现有本地 preset 可作为测试 fixture 或降级展示，但不再作为运行真相。

卡片展示：

- 策略名称和一句话说明。
- 策略类型标签。
- OKX 模拟盘标识。
- 市场类型、标的、周期、仓位、杠杆摘要。
- 风险等级和适用行情。
- `运行`、`编辑` 按钮。

### 7.2 未登录用户

未登录用户可以浏览策略广场。点击 `运行` 或 `编辑`：

1. 保存 intent。
2. 跳转登录。
3. 登录成功后回到对应流程。

登录成功后的准入由内测码登录机制负责，本设计不重复校验内测码。

### 7.3 运行

登录用户点击 `运行`：

1. 前端调用 `POST /strategy-plaza/templates/:id/run`。
2. 若成功，跳转用户策略详情页。
3. 展示“策略已在 OKX 模拟盘运行”。

前端不展示市场、标的、仓位、杠杆编辑表单。可展示确认启用说明，但不能让用户改参数。

### 7.4 编辑

登录用户点击 `编辑`：

1. 前端调用 `POST /strategy-plaza/templates/:id/edit-session`。
2. 跳转 AI Quant 对话页。
3. 对话页显示模板已载入。
4. 用户继续编辑后，走普通生成策略流程。

---

## 8. 错误处理

1. 未登录：跳登录并保留 intent。
2. 无 OKX 模拟交易 API Key：跳 API Key 绑定页并保留待运行模板 intent。
3. 模板不存在或下线：提示“策略暂不可用”，刷新广场。
4. 重复点击运行：后端用 `runRequestId` 返回同一部署结果。
5. 部署失败：显示后端错误原因，并保留重试入口。
6. 编辑 session 创建失败：显示失败原因，用户可重试。

错误码应明确区分：

- `strategy_plaza.template_not_found`
- `strategy_plaza.template_unavailable`
- `strategy_plaza.okx_demo_api_key_required`
- `strategy_plaza.run_idempotency_conflict`
- `strategy_plaza.run_failed`
- `strategy_plaza.edit_session_failed`

---

## 9. 数据边界

官方策略模板是运行真相入口。运行接口只能使用模板内固定参数和用户 OKX 模拟交易账户绑定，不读取前端传入的运行参数覆盖字段。

推荐后端维护一个明确的 `OfficialStrategyPlazaTemplate` 结构。初版可以代码常量或 seed 数据落地，但对外 API 必须稳定。若使用数据库表，必须保留模板 ID、状态、排序、展示元数据、运行 snapshot 绑定、编辑 seed。

---

## 10. 测试策略

### 10.1 后端

覆盖：

1. 模板列表未登录可访问。
2. 模板详情未登录可访问。
3. run 需要登录。
4. run 在无 OKX 模拟交易 API Key 时返回专用错误码。
5. run 成功创建或返回 running 策略。
6. run 使用 `runRequestId` 幂等，不重复创建。
7. run 拒绝前端覆盖市场、标的、仓位、杠杆。
8. edit-session 创建 AI Quant 会话 seed。

### 10.2 前端

覆盖：

1. 策略广场从 API 渲染 6 个策略。
2. 未登录点击运行/编辑跳登录并保存 intent。
3. 无 OKX 模拟交易 API Key 时跳绑定页。
4. 运行成功后跳策略详情页。
5. 编辑成功后跳 AI Quant 对话。
6. 不再展示未标注的 mock 收益率/胜率。

### 10.3 回归

保留现有 AI Quant 对话、发布、回测、部署测试。编辑模板不能绕出新链路，也不能破坏普通用户生成策略流程。

---

## 11. 成功标准

1. 未登录用户能浏览 6 个策略。
2. 未登录用户点击运行/编辑会进入登录。
3. 登录且已绑定 OKX 模拟交易 API Key 的用户点击运行后，策略直接成为自己的 running 策略。
4. 未绑定 OKX 模拟交易 API Key 的用户会被明确引导绑定。
5. 点击编辑能进入 AI Quant 对话并加载对应策略 seed。
6. 前端策略广场不再依赖 mock preset 作为运行真相。
7. 后端运行接口不允许用户覆盖官方模板固定参数。

---

## 12. 后续扩展

1. 内测码登录机制可独立设计。
2. 支持更多交易所或真实盘前，需要新增风险确认和权限校验。
3. 支持模板运营后台时，可在 ops 侧增加审核、上下线、排序、指标说明。
4. 支持真实回测表现展示时，需要绑定数据来源、回测区间、费用模型和免责声明。
