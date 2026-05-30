# quantify-mobile 技术决策记录

按时间倒序记录关键技术选型。每条决策标注：**背景 / 候选 / 判定 / 理由 / 落地范围**。

---

## 2026-05-30 · 巨鲸地址详情 6 tab 重型详情：方案 B 暂缓、标 future（Issue #1791）

**背景**：设计稿 `design/project/mobile/m-screens-whale-discover.jsx:617`（`WhaleProfileDetail`）为全屏 6 tab 详情——基本信息 / 现货 / 永续 / 挂单 / 成交 / 历史，含 P&L 曲线图（period / scope / metric 三个下拉切换）+ 4 个 stat 卡 + 永续持仓明细（保证金 / 多空占比 / ROI / 未实现盈亏）。Flutter app `apps/quantify-mobile/lib/pages/whale/whale_profile_page.dart` 当前为 hero（地址 + 标签 + 资产摘要 + 总持仓估值）+ 2 segment（概览＝持仓列表 + 近期动作 / 交易统计＝盈亏/胜率/方向偏好/资产表现），信息维度少于设计稿。#1791 目标是「6 tab 全量落地 OR 分批 OR 标 future」三选一，先做产品取舍。

**候选**：

| 方案 | 内容 | 取舍 |
|------|------|------|
| A. mock-first 全量落地 | 新增 6 tab（基本信息/现货/永续/挂单/成交/历史）+ P&L 曲线图（period/scope/metric 切换）+ 4 stat 卡 + 永续持仓明细，全部基于 mock | 现货/永续/挂单/成交/历史五个明细 tab 均为依赖真实逐笔成交 / 当前挂单 / 持仓快照 / 历史动作序列的重型数据展示；真实地址数据通道 #1682 未接入，当前只能堆纯 mock 明细页，维护成本高、产品价值低；P&L 曲线的 period/scope/metric 三维切换在 mock 下是无意义的固定曲线；真实接入后明细列口径 / 分页 / 曲线分桶大概率重写，违反 YAGNI |
| B. 暂缓，标记 future（采纳） | 维持现有 hero + 2 segment 形态，6 tab 重型详情 + P&L 图标 future，关联数据依赖 #1682，待真实地址数据接入后单独立 issue | 对齐 #1750/#1770/#1771 已建立的「设计超前 / 真实数据通道未就绪 → 标 future」基线；现有 hero + 概览 / 统计已覆盖地址核心信息（持仓 + 近期动作 + 盈亏统计），零破坏（Never break userspace）；KISS/YAGNI |

**判定**：**采纳方案 B——暂缓，6 tab 重型详情 + P&L 曲线图统一标记为 future**，不纳入当前 quantify-mobile app 信息架构与验收。维持 `whale_profile_page.dart` 现有 hero + 概览 / 交易统计 2 segment 形态。本节仅落文档，不改 app 代码 / 测试、不改设计稿。

- **现货 / 永续 / 挂单 / 成交 / 历史 5 个明细 tab** → future。均依赖真实逐笔成交 / 当前挂单 / 持仓快照 / 历史动作序列（#1682 范围），未接入前不落 mock 明细页。
- **P&L 曲线图（period / scope / metric 三维切换）** → future。三维切换在无真实时序数据下退化为固定占位曲线，无产品价值；待真实盈亏时序接入后随明细 tab 一并落地。
- **4 stat 卡 + 永续持仓明细（保证金 / 多空占比 / ROI / 未实现盈亏）** → future。现有「交易统计」segment 已以 4 个 stat cell（总盈亏 / 胜率 / 已实现 / 未实现）+ 方向偏好条 + 资产表现列表覆盖核心统计维度；永续逐仓明细依赖真实持仓快照，未接入前不补 mock。

**对齐结论（对应 #1791 验收标准逐条）**：

| 验收标准 | 结论 | 依据 |
|---------|------|------|
| [1] 产品确认落地范围（6 tab 全量 OR 分批 OR 标 future），记入 decisions.md | 已满足。结论＝方案 B 标 future，记入本节 | 本节 |
| [2] 若落地：提供 基本信息/现货/永续/挂单/成交/历史 tab + P&L 图 + 4 stat 卡 | 不适用。未落地 6 tab；现有 hero + 概览 / 交易统计形态维持现状 | 本节判定 |
| [3] 若标 future：decisions.md 钉死暂缓结论并关联数据依赖 | 已满足。本节钉死暂缓结论，关联数据依赖 #1682（读路径 REST），后续触发条件见下 | 本节 + 后续触发条件 |

**理由**：

1. #1791 目标是「全量 / 分批 / future」三选一，标 future 分支同样满足验收（验收标准末条「若标 future：decisions.md 钉死暂缓结论并关联数据依赖」）；非「必须实现」。
2. **YAGNI / 依赖未就绪**：现货/永续/挂单/成交/历史明细 + P&L 时序曲线均依赖真实地址数据通道 #1682（读路径 REST），不在当前范围；先实现纯 mock 6 tab 重型详情违反 YAGNI，真实接入后明细列口径 / 分页 / 曲线分桶大概率重写。
3. **Never break userspace**：现有 hero + 概览（持仓 + 近期动作）+ 交易统计（盈亏 / 胜率 / 方向偏好 / 资产表现）已覆盖地址核心信息，是可走通的现役形态；在真实数据与产品价值尚未明确前强行扩为 6 tab 不带来用户价值，保持现状对现有地址详情链路零破坏。
4. 与 #1750/#1770/#1771 处理「设计超前 / 真实数据通道未就绪」一致：设计稿保留高保真表达作为 future 能力，app 按真实数据就绪节奏分批落地，文档钉死暂缓结论，避免每个子任务重新论证。

**设计超前 / future 项（不算对齐缺口）**：6 tab 结构（基本信息/现货/永续/挂单/成交/历史）、P&L 曲线图（period/scope/metric 三维切换）、永续持仓逐仓明细（保证金 / 多空占比 / ROI / 未实现盈亏）——均待真实地址数据通道 #1682 就绪后另行立项评估，未就绪前不在 app 落 mock，也不要在后续 PR 以「对齐缺口」名义补。

**不变项**：`whale_profile_page.dart` 维持 hero（地址 + 标签 + 资产摘要 + 总持仓估值）+ 概览 / 交易统计 2 segment 现状，`whaleProfileProvider` mock 数据形态不变。设计稿 `m-screens-whale-discover.jsx` `WhaleProfileDetail` 的 6 tab + P&L 图表达**保留为 future 能力**，不删除、不回流到 app，直到 #1682 接入真实地址数据后另立 issue 解除。

**后续触发条件**：当 #1682（读路径 REST 接入 whale 数据）在 app 侧产出真实地址明细（现货 / 永续持仓、当前挂单、逐笔成交、历史动作、盈亏时序）时，新立「巨鲸地址详情 6 tab 实现」issue，引用本节作为暂缓结论的解除依据，届时统一评估 6 tab + P&L 图 + 永续明细落地。

**落地范围**：仅文档。`apps/quantify-mobile/docs/decisions.md`（本节）+ `apps/quantify-mobile/README.md`「设计真源」段补 #1791 引用。不改 `design/project/mobile/m-screens-whale-discover.jsx`、不改 `whale_profile_page.dart` 与 app 代码 / 测试。

---

## 2026-05-30 · 登录认证方式基线：维持 app 邮箱+密码，设计稿验证码形态标历史/future（Issue #1788）

**背景**：设计稿 `design/project/mobile/m-screens-1.jsx:124-144`（`ScreenLogin`）登录流程为**邮箱 + 验证码**（「发送验证码」按钮 + `secs` 60s 倒计时 + `sent ? '重新发送'` 重发，无密码字段）。Flutter app `apps/quantify-mobile/lib/pages/auth/login_page.dart:517-559` 为**邮箱 + 密码**（`obscureText` 密码框 + 「忘记?」suffix 入口 + `onSubmitEmail` 提交），无验证码。两者认证交互不同，属真实未对齐缺口，且是产品方向取舍而非纯视觉对齐。

**候选**：

| 方案 | 内容 | 取舍 |
|------|------|------|
| A. 采纳设计稿验证码 | `login_page.dart` 改为邮箱 + 验证码：发送按钮 + 60s 倒计时 + 重发 + 错误态 + 表单校验 + widget 测试 | app 现有 `onSubmitEmail` 邮箱+密码是接真实后端鉴权的可用路径（backend email/password 登录），改为验证码会推翻可用认证链；而验证码下发/校验通道（邮件验证码 OTP）在 app 侧无对应 repository / 后端接口接入，当前只能落纯 mock 倒计时表单，真实接入后大概率重写，违反 YAGNI；且直接破坏现有可登录态（Never break userspace） |
| B. 维持 app 邮箱+密码为准（采纳） | decisions.md 钉死「以 app 邮箱+密码为准」，设计稿验证码形态标历史/future，关闭差异 | 对齐 #1749 §2 已确立的「登录态以 app 为准、`proto.jsx` 登录原型差异不回流」基线；app 邮箱+密码接真实后端鉴权，零破坏；与 #1756/#1770/#1771/#1750 处理「设计超前 / 依赖真实数据通道未就绪」一致 |

**判定**：**采纳方案 B——维持 app 邮箱 + 密码为登录认证唯一基线**。`login_page.dart` 登录表单维持「邮箱 + 密码（`obscureText`）+ 忘记密码入口 + Telegram 一键登录 + 访客模式」现状，不改为验证码。设计稿 `ScreenLogin` 的验证码形态（发送按钮 / 60s 倒计时 / 重发）标记为**历史原型 / future**，不回流 app，差异关闭。本节仅落文档，不改 `login_page.dart` 与测试、不改设计稿。

**对齐结论（对应 #1788 验收标准逐条）**：

| 验收标准 | 结论 | 依据 |
|---------|------|------|
| [1] 产品对「验证码 vs 密码」给出结论并记入 decisions.md | 已满足。结论＝方案 B，以 app 邮箱+密码为准，记入本节 | 本节 |
| [2] 若采纳验证码：login_page 提供验证码输入 + 发送 + 倒计时 + 校验 + 失败态 | 不适用。未采纳验证码，维持邮箱+密码现状 | 本节判定 |
| [3] 若采纳验证码：补 widget 测试（发送→倒计时→重发→提交） | 不适用。未采纳验证码，不新增验证码测试 | 本节判定 |
| [4] 若维持密码：decisions.md 记录结论，设计稿对应屏标注，差异关闭 | 已满足。本节记录方案 B；`m-screens-1.jsx` `ScreenLogin` 验证码形态标历史/future；差异关闭 | 本节 + README 设计真源段补 #1788 引用 |

**理由**：

1. **Never break userspace**：app `onSubmitEmail`（邮箱+密码）是接真实后端鉴权的现役可用登录路径，改为验证码会直接推翻该可用认证链。
2. **YAGNI / 依赖未就绪**：邮件验证码（OTP）下发与校验依赖后端 OTP 接口与 app 侧对应数据通道，当前未接入；先在 app 堆纯 mock 倒计时表单，真实 OTP 接入后口径（重发节流、过期、错误码）大概率重写。
3. **对齐既定基线**：#1749 §2 已钉死「冷启动 / 登录态以 app 为准，`proto.jsx` 登录原型（含 `LoginSheet`、游客 CTA）差异废弃、不回流」；登录认证方式同属该基线，验证码是同一原型层面的超前表达。
4. 与 #1756/#1770/#1771/#1750 处理「设计超前 / 真实数据通道未就绪」一致：设计稿保留高保真表达作为历史/future，app 按真实数据就绪节奏落地。

**设计超前 / 历史项（标 future，不算对齐缺口）**：`ScreenLogin` 的邮箱+验证码形态（发送验证码按钮 / 60s 倒计时 / 重发 / 6 位验证码输入）——待后端邮件验证码（OTP）登录通道就绪后另行立项评估是否引入为第二登录方式，未就绪前不在 app 落 mock，也不要在后续 PR 以「对齐缺口」名义补。

**不变项**：`login_page.dart` 登录表单维持邮箱 + 密码（`obscureText`）+ 忘记密码 suffix 入口 + Telegram 一键登录 + 访客模式现状，`onSubmitEmail` 鉴权路径不变。设计稿 `m-screens-1.jsx` `ScreenLogin` 验证码表达保留为历史/future，不删除、不回流 app，直到后端 OTP 通道接入 issue 立项解除。

**落地范围**：仅文档。`apps/quantify-mobile/docs/decisions.md`（本节）+ `apps/quantify-mobile/README.md`「设计真源」段补 #1788 引用。不改 `design/project/mobile/m-screens-1.jsx`、不改 `login_page.dart` 与 app 代码 / 测试。

---

## 2026-05-30 · 一键部署补齐资金配置/预检查/部署步骤详情：方案 A 落地（Issue #1772，偏离 #1751 既定边界）

**背景**：设计稿 `design/project/mobile/m-screens-deploy.jsx` 的部署流程为多页结构：选交易所（DpSelect）→ 资金配置（DpAllocate，`:759-931`）→ 部署中（DpDeploying，`:977-1084`）→ 成功（DpSuccess，`:1131-1198`），含部署前预检查（PreflightChecks，`:425-585`）。#1751（已 close）确立「部署走 `QzDeploySheet`（单 sheet 内状态机 `pickExchange → authorize → deploying → done`）」并通过验收，**跳过了资金配置页 / 预检查 / 部署步骤详情**。#1772 提出设计稿增强，需先对「落地 / 暂缓」做产品取舍。

**候选**：

| 方案 | 描述 | 取舍 |
|------|------|------|
| A. mock-first 落地（采纳） | 在同一 `QzDeploySheet` 状态机内补齐资金配置页 + 预检查 + 部署分步任务 + 成功详情卡/下一步入口；全部 mock 计时驱动 | 与 #1751/#1752/#1753 已确立的 mock-first 路线一致；运行期不依赖任何写入方先产生数据（不触发数据流跨越）；真实部署接入（#1679/#1682）时仅替换数据来源，UI/状态机/测试不变 |
| B. 暂缓 | 维持 #1751 单 sheet 简化形态，设计稿对应屏标注 future，关闭本 issue | 与同期 #1754（解除 #1651/#1663 暂缓）、#1752/#1753 的 mock-first 落地节奏不一致；这些屏是自包含客户端流，无需真实数据即可落地体验 |

**判定**：**采纳方案 A**。在既有 `QzDeploySheet` 内把状态机扩展为 `pickExchange → authorize → allocate → preflight → deploying → done`，补齐资金配置 / 预检查 / 分步部署 / 成功详情卡 + 下一步入口。

**理由**：

1. 资金配置 / 预检查 / 步骤详情均为自包含客户端体验，mock repository / 计时即可驱动，运行期不依赖后端先产生数据——不构成数据流跨越，零破坏。
2. 对齐 #1751/#1752/#1753 已确立的 mock-first 分批落地路线；真实部署 #1679/#1682 接入时仅替换数据来源。
3. `DeploymentResult` 仅追加 nullable 字段（strategyId/symbol/amount/leverage），现有调用方 `ai_home_page.dart` 零破坏（Never break userspace）。

**边界偏离说明（相对 #1751）**：#1751 既定边界为「单 sheet 简化形态、跳过资金配置/预检查/步骤详情」。本次解除该简化，**但不偏离 #1749 的 sheet/page 形态边界**——仍是单 sheet 内状态机，不新增 page route、不拆多页。设计稿的整页 5 步 StepBar 以 sheet 顶部轻量步骤指示替代（KISS）。

**落地范围**：

- 状态机：`DeployStep` 枚举新增 `allocate` / `preflight`（`deploy_models.dart`）。
- 模型：`DeploymentResult` 追加可选 `strategyId` / `symbol` / `amount` / `leverage`；新增 `DeployAllocation` / `PreflightCheck` / `DeployingStep` 轻量模型。
- UI（`qz_deploy_sheet.dart`）：`_AllocatePane`（投入金额 + 快捷比例 + 单笔仓位上限 + 日内最大亏损 + 通知渠道）、`_PreflightPane`（API/余额/网络逐项扫描 + 失败态重新检测 + 全通过才可部署）、`_DeployingPane`（5 步任务列表逐步动画）、`_DonePane`（完整详情卡 + 查看实盘策略/开启通知/继续调优 三个下一步入口）。
- l10n：`app_zh.arb`（template）+ `app_en.arb` 新增对应 key。
- 测试：`qz_deploy_sheet_test.dart` 覆盖全链路 + 预检查失败态 + 下一步入口 + 未授权流程回归。

**不变项**：未授权交易所流程（`_UnauthorizedPane` → consent → `showApiFormSheet`）维持现状，不进入资金配置（无凭据无法配置）；`/me/live` 入口仍由调用方 `ai_home_page.dart` 在成功后通过 snackbar action 跳转（#1752 联动），成功页「查看实盘策略」入口 pop 返回 result 由调用方处理。真实部署接入前所有数据为 mock。

---

## 2026-05-30 · 回测中 / 回测结果独立页与结果维度补齐：标记 future（Issue #1771）

**背景**：设计稿 `design/project/mobile/m-screens-backtest.jsx` 把回测中（`ScreenBacktestRun`，`:43-164`）与回测结果（`ScreenBacktestResult`，`:273-415`）定义为独立 full-screen 页面，含进度环、引擎日志、三标签页（月度回报热力图 `:481-550` / 交易记录 `:553-598` / 风险分析 `:601-637`）、AI 评估 banner、粘底操作等。当前 Flutter app 仅有内联聊天卡 `QzBacktestProgressCard`（`lib/widgets/qz_backtest_progress_card.dart`，进度百分比 + 线性进度条 + 取消入口）/ `QzBacktestResultCard`（`lib/widgets/qz_backtest_result_card.dart`），结果模型 `lib/data/models/backtest_models.dart:29-45` 共 6 字段（`id` + 5 项结果指标 `totalReturnPercent / maxDrawdownPercent / sharpe / trades / equityCurve`）。

**与既定边界的偏离**：#1751（已 close）明确「回测结果走聊天内卡片，不新增独立 route」，其验收 #3（回测中状态有明确 UI 表达）已由 `QzBacktestProgressCard` 满足（#1760 落地）。本 issue 提出的是**设计稿增强**——是否把回测中 / 结果升级为独立页 + 多维度展示，需先对 #1751 既定简化边界做产品取舍。

**候选**：

| 方案 | 内容 | 取舍 |
|------|------|------|
| A. mock-first 落地 | 新增回测中 / 结果独立 route + 三标签页 + AI 评估 banner，扩展结果模型补 CAGR/Calmar/胜率/盈亏比/平均持仓时长，全部基于 mock | 三标签页（月度热力图 / 交易记录 / 风险分析）+ 进度环 + 引擎日志合计 ~1100 行设计原型，是重型数据驱动展示；真实回测数据依赖 #1679 / #1682 尚未接入，当前只能堆纯 mock 指标页，维护成本高、产品价值低；且与 #1751 已确立的「聊天内卡片」边界相冲突 |
| B. 暂缓，标记 future（采纳） | 维持 #1751 既定聊天卡形态，设计稿对应屏与多维指标标记 future，不进入当前 app 信息架构与验收，待真实回测数据接入后单独立 issue | 对齐 #1662/#1663/#1749/#1750 已建立的「未实现入口 / 设计超前能力的设计表达规范」基线；不破坏 #1751 既定简化边界（Never break userspace）；零破坏、KISS/YAGNI |

**判定**：**采纳 B——暂缓，回测中 / 回测结果独立页与多维结果指标统一标记为 future**，不纳入当前 quantify-mobile app 信息架构与验收。

- **回测中独立页 `ScreenBacktestRun`**（进度环 + 实时统计 + 引擎日志 + 净值曲线 + 粘底取消）→ future。当前以聊天内 `QzBacktestProgressCard`（线性进度条 + 百分比 + 取消）为准，已满足 #1751 验收 #3，不升级为独立 route。
- **回测结果独立页 `ScreenBacktestResult`**（结果 hero + 关键指标网格 + 三标签页 + AI 评估 banner + 粘底两按钮）→ future。当前以聊天内 `QzBacktestResultCard` + 部署按钮为准，不新增独立 route。
- **三标签页**（月度回报热力图 / 交易记录列表 / 风险分析）→ future。均为依赖真实逐笔交易 / 逐月收益序列的重型数据展示，真实数据通道（#1679 回测引擎 / #1682 数据）未接入前不落 mock 页。
- **结果模型缺失指标**（CAGR / Calmar / 胜率 / 盈亏比 / 平均持仓时长）→ future。`BacktestResult` 维持现有结果指标字段（`id` 外 5 项），待真实回测引擎产出对应指标后随独立页 issue 一并扩展，不提前为 mock 补字段。

**理由**：

1. 本 issue 目标是「确认升级 OR 暂缓」二选一，暂缓分支同样满足验收（验收标准末条「若暂缓：设计稿对应屏标注 future，差异关闭」）；非「必须实现」。
2. 真实回测数据依赖 #1679 / #1682，不在当前范围；先实现纯 mock 独立页 + 多维指标违反 YAGNI，且后续接真实引擎数据时大概率重写（指标口径、热力图分桶、交易记录分页均由真实数据形态决定）。
3. 升级为独立页会直接推翻 #1751「回测走聊天内卡片，不新增独立 route」的既定边界——在真实数据与产品价值尚未明确前回退该简化决策，违反 Never break userspace；保持聊天卡形态对现有 AI 对话流零破坏。
4. 与 #1662/#1663/#1749/#1750/#1756 处理「未实现入口 / 设计超前能力」一致：设计稿保留高保真表达作为 future 能力，app 侧按真实数据就绪节奏分批落地，文档钉死暂缓结论，避免每个子任务重新论证。

**不变项**：聊天内 `QzBacktestProgressCard` / `QzBacktestResultCard` 形态与 `BacktestResult` 现有字段（`id` + 5 项结果指标）维持现状，不受本决策影响。设计稿 `m-screens-backtest.jsx` 中 `ScreenBacktestRun` / `ScreenBacktestResult` 及三标签页、AI 评估 banner 的表达**保留为 future 能力**，不删除、不回流到 app，也不在后续 PR 里以「对齐缺口」名义复活，直到真实回测数据接入 issue 立项。

**后续触发条件**：当 #1679（回测引擎）/ #1682（数据通道）在 app 侧产出真实回测结果（逐笔交易、逐月收益、风险指标）时，新立「回测中 / 结果独立页实现」issue，引用本节作为暂缓结论的解除依据，届时再统一评估独立 route + 三标签页 + 结果模型扩展，并同步复核是否解除 #1751 的聊天卡边界。

**落地范围**：仅文档。`apps/quantify-mobile/docs/decisions.md`（本节）+ `apps/quantify-mobile/README.md`「设计真源」段补 #1771 引用。不改 `m-screens-backtest.jsx` / `proto.jsx`、不改 `backtest_models.dart` 与 app 代码 / 测试。

---

## 2026-05-30 · AI 链路「确认策略 / 策略脚本」步骤页：方案 B 暂缓、标 future（Issue #1770）

**背景**：#1770 提出设计稿增强——把 AI 策略生成链路中的「确认策略」（IF/THEN 规则块 + EXECUTE 执行上下文 + AI 提示 banner + 「在对话中修改」编辑链接）与「策略脚本」（terminal 风格代码查看器 + 行号 + copy + 展开/折叠）作为两个显式步骤页落地，并补 5 步 StepBar（确认策略→脚本→设置→回测→部署）与「市场类型（现货/合约）+ 杠杆（1x-100x）」选择器。issue 同时声明这是相对 #1751（已 close，明确「AI 对话直接接 `/ai/backtest-config`，回测走聊天内卡片，不新增独立 route」）既定简化边界的偏离，需先做产品取舍。

**核查发现**：issue 引用的设计源文件 `m-screens-confirm.jsx` / `m-screens-btconfig.jsx` 及 `ScreenStratConfirm` / `ScreenStratScript` / 5 步 StepBar 在当前设计真源中**确实存在**（由 #1748 引入，于本 PR head 与 `origin/main` 均可命中）：`design/project/mobile/m-screens-confirm.jsx:199`（`ScreenStratConfirm`，含 IF/THEN 规则块 + EXECUTE 上下文）、`:704`（`ScreenStratScript`，terminal 风格脚本查看器）、`design/project/mobile/m-screens-btconfig.jsx:285`（`BtcStepBar`）、`:287-288`（`确认策略` / `策略脚本` 标签）。即设计侧已有高保真表达，属「设计稿已画、app 未落地」。但落地与否仍是产品取舍：这些屏的真实价值依赖 #1679/#1682 的真实策略代码生成 / 回测凭据通道，未就绪前在 app 落 mock 步骤页大概率重写；故将其判为 **future 增量**而非「必须立即补齐的对齐缺口」。

**判定**：**采纳方案 B（暂缓）**。维持 #1751 既定的「AI 对话流隐式覆盖确认/脚本步骤」边界；不新增确认策略页、策略脚本页与 5 步 StepBar，不在 `backtest_config_sheet.dart` 回流市场类型 / 杠杆选择器。设计稿对应屏（如后续补画）标 future，本差异关闭。本节仅落文档，不改设计稿、不改 app 代码与测试。

**对齐结论（对应 #1770 验收标准逐条）**：

| 验收标准 | 结论 | 依据 |
|---------|------|------|
| [1] 产品对方案 A/B 给出结论并记入 decisions.md | 已满足。结论＝方案 B 暂缓，记入本节 | 本节 |
| [2] 若落地：确认策略页展示 IF/THEN + EXECUTE | 不落地。AI 对话流隐式覆盖策略确认语义（规则/上下文在对话消息内表达），不新增独立步骤页 | #1751 既定边界、`ai_home_page.dart` 对话流 |
| [3] 若落地：策略脚本页提供代码查看器 + copy | 不落地。脚本查看依赖真实策略代码生成（#1679/#1682），未就绪前不落 mock 查看器 | 依赖未就绪，YAGNI |
| [4] 若落地：链路含 5 步 StepBar | 不落地。当前链路＝AI 对话 → `/ai/backtest-config`（route 承载回测配置弹层）→ 聊天内回测卡片，无多步骤页向导，故无 StepBar | `app_router.dart:178`（`/ai/backtest-config`）、#1749 §3 route↔sheet 边界 |
| [5] 若落地：市场类型 + 杠杆选择器接入回测参数 | 不落地。`backtest_config_sheet.dart` 刻意不承载 symbol/period/leverage，按原型语义「这些字段由 AI 对话上下文推断」 | `backtest_config_sheet.dart:28-29`（不再承载 symbol/period/leverage）、`:155`（对话上下文推断 mock 默认值） |
| [6] 若暂缓：设计稿对应屏标 future，差异关闭 | 已满足。设计源已含对应屏（`m-screens-confirm.jsx:199/704`、`m-screens-btconfig.jsx:285`），现统一记为 future 增量、暂不回流 app；本 issue 以方案 B 关闭 | 本节 + 上方「核查发现」 |

**理由**：

1. **真实问题判定**：当前 AI 链路（对话 → `/ai/backtest-config` → 聊天内回测卡片）已闭环可走通，「确认/脚本显式步骤页」是想象中的增强而非阻塞用户的真实缺口；#1751 已对该简化边界做过现状盘点并采纳。
2. **YAGNI / 依赖未就绪**：策略脚本查看、IF/THEN 规则块均依赖真实策略代码生成与回测接入（#1679/#1682）。在 mock 阶段堆砌步骤页与脚本查看器，真实接入后大概率重写，违反 KISS/YAGNI。
3. **route↔sheet 硬边界**：#1749 §3 已钉死「同一交互不允许同时存在 route + sheet 两条入口」，且 `backtest-config` 以 route 承载弹层视觉、不回退独立 sheet。新增 5 步向导会引入第二条与回测配置并行的链路形态，与该边界冲突。
4. **杠杆/市场类型语义归属**：`backtest_config_sheet.dart` 明确「symbol/period/leverage 由 AI 对话上下文推断，参数弹层只管回测配置」。把这些选择器塞进步骤页会割裂「对话是唯一会话上下文持有者」的契约。
5. 与 #1662/#1749/#1750/#1756 处理「设计超前 / 未实现入口」一致：设计表达保留为 future，app 按真实数据就绪节奏分批落地，零破坏（Never break userspace）。

**设计超前项（标 future，不算对齐缺口）**：确认策略页（IF/THEN + EXECUTE）、策略脚本页（代码查看器 + copy + 展开折叠）、5 步 StepBar、市场类型 + 杠杆选择器——均待真实策略代码生成 / 回测凭据通道（#1679/#1682）就绪后另行立项评估，未就绪前不在 app 落 mock，也不要在后续 PR 以「对齐缺口」名义补。

**不变项**：AI 链路维持「对话 → `/ai/backtest-config`（route 承载回测配置弹层）→ 聊天内回测卡片」现状；`backtest_config_sheet.dart` 维持不承载 symbol/period/leverage、底部 shield 免责 banner 现状（`:581`）。设计稿不新增 confirm/script/StepBar 屏，已存在则标 future、不回流到 app，直到 #1679/#1682 接入真实能力后另立 issue 解除。

**落地范围**：仅文档。`apps/quantify-mobile/docs/decisions.md`（本节）+ `apps/quantify-mobile/README.md`「设计真源」段补 #1770 引用。不改 `design/project/mobile/*.jsx`、不改 `app_router.dart` / `backtest_config_sheet.dart` / `ai_home_page.dart` 与 app 代码 / 测试。

---

## 2026-05-30 · API 配置入口与授权表单设计对齐（Issue #1756）

**背景**：设计稿用 `ScreenApiConfig`（`m-screens-4.jsx:2821`）/ `sheet === 'api'`（`proto.jsx:312`）表达 API 配置；Flutter app 已统一为 `showApiFormSheet`（`lib/pages/me/api_form_sheet.dart`），历史 `/me/api` 列表页 #1648 已下线、router 不再注册（见本文 §「API 配置入口命名与历史路由」）。#1756 目标是把**入口唯一性、表单字段、授权权限、保存反馈、部署未授权交易所引导**这五处的设计表达一次性钉到 app 现状，避免后续设计稿再画独立列表页或第二条入口。

**判定**：**一律以 Flutter app `ApiFormSheet` / `QzDeploySheet` 当前实现为准**；`ScreenApiConfig` 中超出 app 的能力按「设计超前 / future」处理，不在本 issue 回流。本节仅落文档，不改设计稿、不改 app 代码。

**对齐结论（对应 #1756 验收标准逐条）**：

| 验收标准 | 结论 | 依据 |
|---------|------|------|
| [1] 不再出现独立 `/me/api` 列表页 | 已满足。唯一形态为 bottom sheet，无 route；router 无 `/me/api`，`proto.jsx` 也只有 `sheet === 'api'`，无列表页 | `app_router.dart`、`proto.jsx:312` |
| [2] 入口只从我的页与部署流程触发 | 已满足。两类触发面：我的页 1 处 + 部署弹层 2 处，全部收敛到同一 `showApiFormSheet`，无独立 route。① 我的页交易所行「连接 / 管理」→ `showApiFormSheet`；② 部署弹层未授权交易所 consent 后 `_openApiForm` → 同一 sheet；③ 部署弹层空列表兜底入口 `_goConfigureApi`（固定 `exchange:'Binance'`）→ 同一 sheet | `me_home_page.dart:328`、`qz_deploy_sheet.dart:146`（`_openApiForm`）、`qz_deploy_sheet.dart:157`（`_goConfigureApi`，空列表兜底） |
| [3] 字段 / 权限提示 / 保存反馈与 app 一致 | 以 app 为准固定：字段＝交易所徽标（锁定，sheet 内不可改）+ API Key（必填，≥16）+ Secret（必填、可见性切换、≥16）+ 备注（可选，≤30）；权限区＝读取账户与持仓/现货下单（必需）+ 合约下单（可选）+ 提币（必须关闭，红色禁止行）；保存成功 `pop(true)` 关闭并刷新列表，失败显示固定通用文案 SnackBar（不透传后端原文，避免泄露请求体/内部字段） | `api_form_sheet.dart` `_PermissionList` / `_save` |
| [4] 部署未授权交易所引导到同一 API 表单 | 已满足。`QzDeploySheet` 未授权流＝3 步授权引导 + 提币警告 + 合规 checkbox → consent 后打开同一 `showApiFormSheet`；已授权交易所走原权限授权流，不再二次配置 | `qz_deploy_sheet.dart:113`（`_pickUnauthorized` 引导入口）、`:140`（`_openApiForm`）、`:146`（`showApiFormSheet` 调用） |

**设计超前项（标 future，不算对齐缺口）**：`ScreenApiConfig` 含以下 app 未实现能力，均依赖真实凭据读写（#1682）就绪后另行立项，未接入前不在 app 落 mock 表单，也不要在后续 PR 里以「对齐缺口」名义补：

- **环境切换（主网 / 测试网）+ 测试网密钥提示 / 接口域名展示**：app 当前不区分 env，保存按钮固定「保存」。
- **按交易所差异化授权形态**：Hyperliquid 钱包模式（主钱包地址 + Agent 私钥，无 key/secret）、OKX 家族 Passphrase 字段。app 当前为通用 key+secret+备注表单。
- **「验证并保存」服务端校验语义**：app 当前仅做客户端非空 / 最小长度校验 + 直接 `addKey`，真实下单前校验随 #1682 接入。

**理由**：

1. #1756 是设计表达对齐 issue（`documentation`），目标是钉死「以 app 为准」基线，非补齐 app 功能；env/wallet/passphrase 均为数据驱动能力，真实凭据通道（#1682）未就绪前实现违反 YAGNI 且后续大概率重写。
2. 入口唯一性、字段、权限、保存反馈、部署引导五处在 app 侧已收敛且自洽，本节把结论文档化，避免每个子任务重新论证。
3. 与 #1662/#1749/#1750 处理「未实现 / 设计超前入口」一致：设计稿保留高保真表达作为 future 能力，app 按真实数据就绪节奏分批落地，零破坏。

**不变项**：`showApiFormSheet` 命名与 `ApiFormSheet` 字段 / 权限 / 反馈维持现状；`QzDeploySheet` 未授权引导流维持现状。`ScreenApiConfig` 的 env/wallet/passphrase 表达保留为 future，不删除、不回流到 app，直到 #1682 接入真实凭据读写后另立 issue 解除。

**落地范围**：仅文档。`apps/quantify-mobile/docs/decisions.md`（本节）+ `apps/quantify-mobile/README.md`「设计真源」段补 #1756 引用。不改 `proto.jsx` / `m-screens-4.jsx`、不改 `app_router.dart` 与 app 代码 / 测试。

---

## 2026-05-30 · 巨鲸搜索与地址监控管理：落地实现（解除 #1651/#1663 暂缓，Issue #1754）

**背景**：#1663 把巨鲸首页搜索按钮（待 #1651 收口搜索范围）与监控 tab「添加地址监控」按钮钉为禁用态，作为「未实现入口」基线。#1754 目标是「实现 OR 标 future」二选一，本节给出结论并解除上述两处暂缓。

**候选**：

| 方案 | 内容 | 取舍 |
|------|------|------|
| A. 继续标 future | 维持禁用态，等真实数据通道（#1682/#1683） | 与 #1751/#1752/#1753 已确立的 mock-first 路线不一致；搜索/监控 CRUD 是自包含客户端流，无需真实数据即可落地体验 |
| B. mock-first 实现（采纳） | 搜索 sheet（地址/标签/资产/交易所/事件类型）+ 监控规则 CRUD（增删改静音）+ 表单校验，全部基于 mock repository | 对齐 #1751/#1752/#1753；运行期不依赖任何写入方先产生数据（不触发数据流跨越）；真实读写接入时仅替换 repository 实现，UI/校验/测试不变 |

**判定**：**采纳 B——落地实现**。

- 搜索按钮 `onTap` 接 `WhaleSearchSheet.show`（解除 #1651 暂缓）。
- 「添加地址监控」按钮接 `WhaleWatchRuleSheet`（解除 #1663 暂缓）；监控行支持编辑 / 静音 / 删除（确认弹窗）。
- 监控规则字段（地址 / 阈值 / 方向 / 渠道）带表单校验与行内错误提示。

**理由**：

1. issue 目标二选一，实现分支同样满足验收；搜索与 CRUD 无后端依赖。
2. mock CRUD 为 **session 内存态**：UI 持 `List<WatchRule>` 作单一数据源，重建 app 回到种子。真实持久化随 #1682（监控数据）/ #1683（实时推送）接入，届时替换 `WhaleWatchRepository` 实现即可。
3. 与既有 repository/provider/Unimplemented 占位约定一致，零破坏。

**落地范围**：

- 模型：`lib/data/models/whale_watch_models.dart`（`WatchRule` / `WhaleSearchResult` 等）。
- 数据：`lib/data/repositories/whale_watch_repository.dart`、`lib/data/mock/mock_whale_watch_repository.dart`、`lib/data/mock/fixtures/whale_watch.dart`、`unimplemented_repositories.dart` 占位、`providers.dart` 注册、两个 barrel。
- UI：`lib/pages/whale/widgets/whale_search_sheet.dart`、`whale_watch_rule_sheet.dart`；`whale_home_page.dart` 搜索按钮接线；`whale_watch_tab.dart` 改 ConsumerStatefulWidget 承载 CRUD。
- 文案：`lib/l10n/app_zh.arb` + `app_en.arb`（双语）+ 重新生成 localizations。
- 测试：`test/data/mock_whale_watch_repository_test.dart`、`test/pages/whale_search_sheet_test.dart`、`test/pages/whale_watch_rule_sheet_test.dart`；翻转 `whale_home_page_test.dart` 两个禁用态守护。

---

## 2026-05-30 · 行情二级入口归属：聚合挂单 / 预测市场 / 币股 标记为 future（Issue #1750）

**背景**：设计稿 `proto.jsx` 行情域（`under: 'market'`）除 `/market`（`ScreenTickers`）、交易详情（`ScreenOrderEntry`）、多空比（`ScreenLongShort`）外，另挂三个二级入口——聚合挂单 `ScreenAggOrders`、预测市场 `ScreenPredMarket`、币股 `ScreenCoinStocks`（完整高保真实现见 `m-screens-data.jsx`）。Flutter app 当前仅注册 `/market`、`/market/long-short`、`/market/:symbol`，未注册这三个入口。#1749 §1 已把「`数据 hub` 二级入口聚合挂单 / 预测市场 / 币股」的命名归属统一钉到 `行情` Tab，但**未对「是否进入当前 app 信息架构」给出结论**，本节补齐该结论。

**候选**：

| 方案 | 内容 | 取舍 |
|------|------|------|
| A. 立即实现 | 补三个 full-screen route + 页面 + mock 数据 + 入口 + 空/错态 + widget tests | 设计稿这三屏是重型数据 hub（聚合订单簿 + 深度图 + 持仓量表 + 成交量表 / 预测市场网格 + 详情 sheet / 币股表 + 排序 + 详情），合计 ~2700 行原型；真实数据依赖 #1682/#1683 尚未接入，当前只能堆纯 mock 展示页，维护成本高、产品价值低 |
| B. 标记 future（采纳） | 不进入当前 app 信息架构，文档钉死「暂缓 + 不纳入当前验收」，待真实数据接入后单独立 issue | 对齐 #1662/#1663/#1749 已建立的「未实现入口的设计表达规范」基线；零破坏、KISS/YAGNI |

**判定**：**三个入口统一标记为 future，不纳入当前 quantify-mobile app 信息架构与验收**。

- **聚合挂单 `ScreenAggOrders`** → future。真实数据依赖跨所聚合订单簿 / 持仓量 / 成交量接入（#1683 范围），未接入前不落 mock 页。
- **预测市场 `ScreenPredMarket`** → future。依赖 Polymarket 类链上事件数据源，当前 app 无对应 repository / 数据通道。
- **币股 `ScreenCoinStocks`** → future。依赖加密相关股票行情数据源（#1682 范围），当前 app 无对应数据通道。

**理由**：

1. issue 目标是「明确落地策略：实现 OR 标 future」，不是「必须实现」；二者择一即满足验收。
2. 三屏均为数据驱动页面，真实数据源（#1682 币股 / #1683 聚合）不在当前范围；先实现纯 mock 页违反 YAGNI，且后续接真实数据时大概率重写。
3. 与 #1662/#1663/#1749 处理「未实现入口」的方式一致：设计稿保留高保真表达，app 侧按真实数据就绪节奏分批落地，文档钉死归属与暂缓结论，避免每个子任务重新论证。

**不变项**：`/market` 行情列表、`/market/long-short` 多空比、`/market/:symbol` 交易详情维持现状，不受本决策影响。设计稿 `m-screens-data.jsx` / `proto.jsx` 中这三屏的表达**保留为 future 能力**，不删除、不回流到 app，也不在后续 PR 里以「对齐缺口」名义复活，直到对应真实数据接入 issue 立项。

**后续触发条件**：当 #1682（币股行情）/ #1683（聚合数据）对应数据通道在 app 侧就绪时，分别为聚合挂单 / 币股新立「行情二级入口实现」issue，引用本节作为暂缓结论的解除依据；预测市场待 Polymarket 数据源接入范围明确后另行立项。

**落地范围**：仅文档。`apps/quantify-mobile/docs/decisions.md`（本节）+ `apps/quantify-mobile/README.md`「设计真源」段补 #1750 引用。不改 `proto.jsx` / `m-screens-*.jsx`、不改 `app_router.dart` 与 app 代码 / 测试。

---

## 2026-05-30 · 移动端设计基线复核：Tab、`数据→行情` 命名、登录态与路由形态（Issue #1749）

**背景**：`design/project/mobile/` 是 quantify-mobile 设计真源，但 `proto.jsx` 及 `m-screens-*.jsx` 与 Flutter app 当前产品基线在以下点上仍有差异：底部 Tab 顺序、`数据 / 行情` 命名、冷启动入口、登录保护、游客页 / 登录弹层、full-screen route 与 bottom sheet 边界。#1662 已固定 screen graph 与登录态策略，但**未显式记录 `proto.jsx` 自身的 Tab 排序 / 命名 / `LoginSheet` 形态属于已废弃差异**，导致子任务对齐时仍需逐个重新解释。本节把这组差异一次性钉死，作为 #1750–#1757 等后续移动端设计对齐 issue 的前置基线。

**判定**：**一律以 Flutter app 当前实现为准**；`proto.jsx` / `m-screens-*.jsx` 中与下表冲突的表达视为历史原型差异，不再回流到 app，也不要在后续 PR 里复活。本节仅落文档，不改设计稿、不改 app 代码。

### 1. 底部 Tab 顺序与命名（以 app 为准）

| index | 路径 | app 名称（`QzBottomTabBar` / l10n） | `proto.jsx` 旧表达 | 差异判定 |
|------|------|--------------------------------|-------------------|---------|
| 0 | `/ai` | AI 量化 | `TAB_SCREENS[1]` `ai` `AI 量化`（排第 2） | 顺序以 app 为准：AI 量化置首 |
| 1 | `/market` | 行情（`tabMarket`） | `TAB_SCREENS[2]` `market` **`数据`**（排第 3） | **`数据` 统一改称 `行情`**；顺序提到第 2 |
| 2 | `/strategy` | 策略 | `TAB_SCREENS[0]` `strat` `策略`（排第 1） | 顺序以 app 为准：策略置第 3 |
| 3 | `/whale` | 巨鲸 | `whale` `巨鲸` | 一致 |
| 4 | `/me` | 我的 | `me` `我的` | 一致 |

- `proto.jsx` 中 `MTabBar` 的 `策略 / AI 量化 / 数据 / 巨鲸 / 我的` 顺序与首项命名均为旧基线，**以 app `AI 量化 / 行情 / 策略 / 巨鲸 / 我的` 为准**。
- 设计稿中所有 `数据`（含 `m-screens-data.jsx` 文件头注释的「数据 hub」、二级入口聚合挂单 / 预测市场 / 币股的归属）在产品语义上统一表述为 **`行情`**；`行情` 作为 Tab 1 名称与其二级页面的归属容器。下游 #1750（行情二级入口）直接引用本条，不再单列命名差异。

### 2. 冷启动入口、游客模式与 `/me` 登录保护（以 app 为准）

| 入口态 | 默认落地 | 规则 |
|-------|---------|------|
| 未登录（无 session） | `/login` | `initialLocation: '/login'`；访问 `/me` 或 `/me/*` redirect 回 `/login` |
| 游客（登录页内「访客模式」或直接 tap 公开 tab） | `/ai`（或所点 tab） | 行情 / AI / 巨鲸 / 策略 允许匿名浏览；仅 `/me` 前缀受 `kAuthProtectedPrefixes` 守卫 |
| 已登录 | `/ai` | 已登录访问 `/login` redirect 到 `/ai` |

- **冷启动以 `/login` 为准**，已登录跳 `/ai`；`proto.jsx` 默认 `setScreen('ai')` 是原型省略了鉴权，以 app 为准。
- **游客入口在登录页内**（登录页内「访客模式」CTA），不是全局弹层。`proto.jsx` 中 `LoginSheet` + 游客 CTA `setSheet('login')` 把登录表达成全局 bottom sheet，**该形态废弃**：app 侧登录是独立 `/login` 全屏页（`LoginPage`），不存在默认 `LoginSheet`。
- `/me` 与 `/me/*` 受登录保护，是 `proto.jsx` 未表达的真实约束，以 app `kAuthProtectedPrefixes = ['/me']` 为准。

### 3. Full-screen route 与 bottom sheet 判定边界

沿用 #1662 第 3 节的判定标准，复述边界供子任务直接引用：

**Full-screen route**（top-level `GoRoute`，push 覆盖 tab bar）适用于：需要深链 / 浏览器返回栈语义；生命周期跨 tab 切换；有独立 AppBar / 滚动容器、内容超过半屏。当前命中：`/login`、`/market/long-short`、`/market/:symbol`、`/strategy/:id`、`/me/theme`、`/ai/backtest-config`。

**Bottom sheet**（`showModalBottomSheet` 系列，无独立 route）适用于：局部交互、用完即销毁；触发点与归属页面强绑定；内容高度可控（半屏 / 自适应）。当前命中：`showApiFormSheet`、order entry sheet。

**硬边界：同一交互不允许同时存在 route + sheet 两条入口。** `api` 入口统一为 sheet（`showApiFormSheet`，历史 `/me/api` 列表页已下线、router 不再注册）；`backtest-config` 以 route 形式承载弹层视觉，保持现状不回退独立 sheet。后续 #1756（API 配置入口）/#1757（策略详情形态）直接引用本条边界，不再重新论证。

### 4. 与子任务的引用关系

本节是 #1750–#1757 的前置基线依赖：子任务在做页面级对齐时，凡涉及 Tab 顺序 / 命名、登录态 / 守卫、route↔sheet 形态判定，直接引用本节与 #1662，不在各自 PR 里重复解释同一组差异。

**落地范围**：仅文档。`apps/quantify-mobile/docs/decisions.md`（本节）+ `apps/quantify-mobile/README.md`「设计真源」段补 #1749 引用。不改 `proto.jsx` / `m-screens-*.jsx`、不改 app 代码与测试。

---

## 2026-05-23 · 巨鲸首页搜索、通知中心、默认 Tab 与监控入口对齐（Issue #1663）

**背景**：依据 #1662 已建立的"未实现入口的设计表达规范"基线，对 `WhaleHomePage` / `WhaleNotificationSheet` / `WhaleWatchTab` 做逐项对齐核对。

**判定**：仅对齐，不引入新能力。

| 项 | 设计稿（`m-screens-4.jsx`） | Flutter 处理 | 决策 |
|----|------------------------|------------|------|
| 顶部搜索 icon 按钮 | `iconBtn` 无 onClick | `_CircularIconAction(onTap: null)` + 注释 | 保持禁用态；搜索范围待 #1651 收口 |
| 顶部通知铃铛 + unread badge | 显示 badge、点击展开 panel | `QzNotificationBell(circular:true)` + `_openNotifications` | 已对齐 |
| 通知中心 4 个 tab | `['全部','巨鲸预警','监控触发','系统']` | `_Tabs` 同顺序 + 单次遍历计数 | 已对齐；新增 dx 坐标顺序守护测试 |
| 「全部已读」按钮 | `markAllRead` | `_markAllRead` + 未读为 0 时禁用 | 已对齐 |
| 通知设置入口 | `<Ico ICONS.tune/>通知设置`（设计稿亦无 onClick） | snackbar 提示「通知设置」 | **已知例外**：保留 snackbar 提示比纯禁用更友好，待设置页落地后替换为路由 push |
| 默认 tab | `useState('实时')` | `_tabIndex = 1` | 已对齐；新增测试守护文案高亮 |
| 监控 tab「添加地址监控」按钮 | `<button>` 无 onClick | 原 `onPressed: () {}` (空 lambda → ripple) | **改为 `onPressed: null`**；对齐设计稿无 onClick 语义；测试守护 |
| 监控 tab「规则 ›」 | `<span>` 无 onClick | 纯 `Text` | 已对齐 |

**落地范围**：

- `apps/quantify-mobile/lib/pages/whale/tabs/whale_watch_tab.dart`：添加地址监控按钮 `onPressed: null`。
- `apps/quantify-mobile/test/pages/whale_home_page_test.dart`：新增「默认实时 tab 高亮」+「添加地址监控按钮禁用」守护用例。
- `apps/quantify-mobile/test/pages/whale_notification_sheet_test.dart`：新增「tab 顺序固定」用例。

**通知设置入口例外说明**：通知设置在设计稿中是纯展示，未挂 onClick，但其语义是"待落地的设置入口"而非"完全不可达"。Flutter 用 snackbar 给出文案提示比禁用更接近设计意图。后续 issue 收口设置页时，将 snackbar 替换为路由 push 即可，不影响当前对齐基线。

---

## 2026-05-23 · 移动端设计对齐基线（Issue #1662）

**背景**：`design/project/mobile/` 是 quantify-mobile 设计真源，但设计稿（`proto.jsx`）与 Flutter 工程（`lib/router/app_router.dart`）在入口态、登录保护、次级页面呈现形态、API 入口命名、token 路径上存在基线差异。后续页面对齐 PR 需要先固定这些约定，避免每个页面重新解释。

**判定**：以 Flutter 当前实现为基线、设计稿差异在本节明示并接受。后续 issue 引用本节作为对齐参照。

### 1. Screen graph

底部 5 个 tab（`StatefulShellRoute.indexedStack`，顺序与 `QzBottomTabBar` 一致）：

| index | 路径 | 名称 | 设计稿对应（`proto.jsx` TAB_SCREENS） |
|------|------|------|------------------------------------|
| 0 | `/ai` | AI 量化 | `ai` → `ScreenAIChat` |
| 1 | `/market` | 行情 | `market` → `ScreenTickers` |
| 2 | `/strategy` | 策略 | `strategy` → `ScreenStrategy` |
| 3 | `/whale` | 巨鲸 | `whale` → `ScreenWhale` |
| 4 | `/me` | 我的 | `me` → `ScreenAccount` |

次级视图（top-level route，push 后覆盖 tab bar）：

| 路径 | 页面 | 设计稿对应（`proto.jsx` SUB_SCREENS） |
|------|------|------------------------------------|
| `/login` | `LoginPage` | `login`（`under: null`） |
| `/market/long-short` | `LongShortPage` | `ls`（`under: market`） |
| `/market/:symbol`（正则 `[A-Z0-9-]{2,}`） | `MarketDetailPage` | `trade`（`under: market`） |
| `/strategy/:id` | `StrategyDetailPage` | 设计稿未单列，沿用 strategy tab 内 push |
| `/me/theme` | `ThemeSettingsPage` | `theme`（`under: me`） |
| `/ai/backtest-config` | `BacktestConfigSheet`（页面壳，本质 bottom sheet 内容） | 设计稿对应 `sheet === 'config'` 弹层 |

Dev 路径（仅 `kDebugMode`）：`/_dev/theme-preview`、`/_dev/components-preview`。

Bottom sheet（无独立 route，由调用方 `showXxxSheet(context, ...)` 打开）：

| 入口 | sheet | 设计稿对应 |
|------|------|----------|
| 我的页「连接」/「管理」、一键部署弹层 | `showApiFormSheet`（`api_form_sheet.dart`） | `sheet === 'api'`（`ScreenApiConfig`） |
| 交易详情「买入」/「卖出」 | order entry sheet | `sheet === 'buy' / 'sell'`（`ScreenOrderEntry`） |
| AI 首页「参数」 | 回测参数 sheet | `sheet === 'config'`（已通过 `/ai/backtest-config` 页面壳承载，behaves as sheet） |

### 2. 入口态与登录跳转

| 入口态 | 默认落地 | 跳转规则 |
|-------|---------|---------|
| 未登录（无 session） | `/login` | `initialLocation: '/login'`；访问 `/me` 或 `/me/*` 时 redirect 回 `/login` |
| 游客（点登录页「访客模式」/未登录直接 tap tab） | `/ai`（或所点 tab） | 行情 / AI / 巨鲸 / 策略 全部允许匿名浏览；只有 `/me` 前缀被 `kAuthProtectedPrefixes` 守卫 |
| 已登录 | `/ai` | session 非空时访问 `/login` redirect 到 `/ai`；其他 tab 状态保留 |

与设计稿差异：`proto.jsx` 默认 `setScreen('ai')`、`/me` 直接可点。Flutter 出于真实鉴权需求保留 `/login` 作为冷启动落地，仅在已登录态等价于设计稿默认 `/ai`；`/me` 守卫是设计稿原型未表达的真实约束，**以 Flutter 实现为准**。

### 3. Full-screen route vs Bottom sheet 判定边界

**Full-screen route**（top-level `GoRoute`、push 覆盖 tab bar）适用于：

- 需要深链 / 浏览器返回栈语义（如 `/market/:symbol`、`/strategy/:id`）
- 生命周期跨 tab 切换（push 后允许用户切走再回来仍在同一页）
- 页面有独立 AppBar / 滚动容器，内容超过半屏
- 当前命中：`/login`、`/market/long-short`、`/market/:symbol`、`/strategy/:id`、`/me/theme`、`/ai/backtest-config`

**Bottom sheet**（`showModalBottomSheet` 系列、无独立 route）适用于：

- 局部交互、用完即销毁，不需要返回栈复用
- 触发点与归属页面强绑定（如「我的」页内调出 API 配置）
- 内容高度可控（半屏 / 自适应），用户预期是「短暂遮盖」而非「跳走」
- 当前命中：`showApiFormSheet`、order entry sheet

**边界**：同一交互不允许同时存在 route + sheet 两条入口。`api` 入口已统一为 sheet（见下节）；`backtest-config` 当前是 route 形式承载 sheet 视觉，**保持现状不再回退到独立 sheet**（issue #1658 已对齐设计稿固定大弹层形态）。

### 4. API 配置入口命名与历史路由

- 唯一入口：`showApiFormSheet(context, exchange: ...)`，从「我的」首页（「连接」/「管理」按钮）与「一键部署弹层」中触发。
- 历史 `/me/api` 列表页已下线（issue #1648），router 中**不再注册该路径**，不要在新 PR 中复活。
- 设计稿 `proto.jsx` 中 `screen === 'me' && (txt === '连接' || txt === '管理') → setSheet('api')` 即此入口的设计稿语义，命名以 Flutter 侧 `showApiFormSheet` / `ApiFormSheet` 为准。

### 5. 设计 token 路径基线

- 真源：`design/project/tokens.css`（被 `design/project/mobile/Quantify Mobile App.html` 通过 `../tokens.css` 引用）。
- 不在 `design/project/mobile/` 下重复一份 `tokens.css`，避免漂移。
- README「设计真源」段已同步该路径。后续 PR 引用 token 时统一指向 `design/project/tokens.css`，禁止再写「`design/project/mobile/tokens.css`」。

**落地范围**：本决策仅落文档（本节 + `README.md` 设计真源段）。后续页面对齐 issue 引用本节作为基线，不在每个 PR 里重新解释。

### 6. 策略详情形态与「载入到对话」主操作（Issue #1666 / #1757）

**背景**：设计稿 `m-screens-2.jsx` 中 `StratDetail` 以 bottom sheet 形式呈现（`m-screens-2.jsx:986` `function StratDetail`，`borderRadius:'20px 20px 0 0'` + 顶部拖拽条 + `qfSheetUp` 上滑动画 + 半透明遮罩），底栏三按钮为「分享（ghost）→ 载入对话（ghost）→ 运行策略（`run-strat`，紫色渐变主操作）」；Flutter 一直把 `/strategy/:id` 实现为 full-screen `StrategyDetailPage`。#1666 已就形态与主操作做出技术决策，#1757 负责把该决策回流为设计基线文档，逐条钉到 app 现状，避免后续设计稿反复出现 sheet 与 route 冲突。

**判定**：以 Flutter app `/strategy/:id` full-screen route 当前实现为准；设计稿 sheet 形态仅作视觉探索，不作为 app 验收基线。

- **形态保持 full-screen route**——`/strategy/:id` 命中本节 #3 的硬条件（需要深链 / 浏览器返回栈语义、内容超过半屏、列表卡片 push 进入需保留返回路径），不迁移到 bottom sheet。
- **底部主操作 = 「载入到对话」**——app 刻意把设计稿底栏 `run-strat`（运行策略）的紫色渐变主操作位让给「载入到对话」，对齐 #1666 决策；按钮顺序固定为「分享（ghost）→ 载入到对话（accent，主操作，`Expanded`）→ 订阅（ghost，`Expanded`）」，不保留独立「运行」按钮。
- **载入对话流程统一**——复用 `strategy_home_page._onLoadConversation` 的 toast helper：显示 `LoadConversationToast`，~700ms 后 `context.go('/ai?loadStrategy=<id>')`；timer 在 dispose / 重复点击时安全取消。toast key 与列表页保持一致 `strategy-load-conversation-toast`。

**验收对照（以 #1757 验收标准逐条核对，全部以 app 现状为基线）**：

| # | 验收标准 | 结论 | app 证据 |
|---|---------|------|---------|
| [1] | 详情在 app 中是 full-screen route，不是 bottom sheet | 已满足。`/strategy/:id` 注册为 top-level `GoRoute`，builder 返回 `StrategyDetailPage`（带独立 `Scaffold`/`AppBar`），push 覆盖 tab bar；router 无对应 sheet | `lib/router/app_router.dart`（`/strategy/:id`）、`lib/pages/strategy/strategy_detail_page.dart` |
| [2] | 主操作为「载入到对话」，行为与 app 一致 | 已满足。accent 主按钮 → toast → 700ms → `context.go('/ai?loadStrategy=<id>')`；detail 未加载完时按钮 disabled，避免空 toast | `strategy_detail_page.dart:84`（`_onLoadConversation`）、`:97`（`context.go`） |
| [3] | 按钮顺序、文案、跳转目标与 app 一致 | 已满足。底栏顺序＝分享（`strategy-detail-share-btn`，ghost）→ 载入到对话（`strategy-detail-load-chat-btn`，accent）→ 订阅（`strategy-detail-subscribe-btn`，ghost）；文案走 l10n（`strategyDetailShareButton` / `strategyDetailLoadConversation` / `strategyDetailSubscribe`）；跳转目标 `/ai?loadStrategy=<id>` | `strategy_detail_page.dart:281`-`:317` |
| [4] | 若设计稿仍保留 sheet 展示，必须标为视觉探索而非验收基线 | 已满足。`m-screens-2.jsx` `StratDetail` sheet + 底栏 `run-strat` 主操作均标记为**视觉探索**，不作为 app 验收基线；app 一律以 full-screen route + 「载入到对话」accent 主操作为准 | 本节「判定」首句 + 本表 |

**不变项**：设计稿 `StratDetail` 中已有的「收益曲线 + 统计网格 + 策略参数 + 策略说明」内容已在 Flutter 详情页覆盖（#1565），本次不扩展也不删减；不回流设计稿 `run-strat`（运行策略）独立按钮。本节仅落文档，不改设计稿、不改 app 代码。

---

## 2026-05-18 · K 线图表组件库选型（Issue #1513）

**背景**：#1510 行情详情页用 `QzKlinePlaceholder` 占位 K 线；本次接入真实绘制，覆盖周期切换 + 缩放 + 拖动 + 长按十字光标 + mock 推流追加。

**候选**：

| 库 | 优 | 劣 |
|----|----|----|
| `k_chart_plus` 1.0.4 | 蜡烛 + 缩放 + 拖动 + 长按十字光标全开箱；支持 MA/BOLL/MACD/KDJ/RSI 等指标；BSD-3；依赖干净（`decimal`、`intl`） | unverified uploader；体积比自绘大；time 字段为 ms（与 Dart `DateTime` 自然对接） |
| `fl_chart` | 维护活跃、社区大 | K 线无原生 widget，需自定义 painter + 手势 |
| 自绘 `CustomPainter` | 完全可控 | 手势 + 长按十字光标工作量翻倍，违反 KISS |

**判定**：选 `k_chart_plus ^1.0.4`。

**理由**：

1. Issue 范围明确为"原型只要主图 + 周期切换，不要复杂指标"，`k_chart_plus` 默认配置即覆盖
2. 缩放 / 拖动 / 长按十字光标三项手势库内置 `isScale` / `isDrag` / `isLongPress` 状态，零额外接线
3. `KLineEntity` 字段（`open`/`high`/`low`/`close`/`vol`/`amount`/`time`）与本地 `Candle` 模型一一对应
4. 依赖图干净（`decimal` + `intl`），不引入巨型传递依赖
5. 自绘方案在原型阶段性价比过低

**落地范围**：

- 新增 widget：`lib/widgets/qz_kline_chart.dart`
- pubspec 依赖：`k_chart_plus: ^1.0.4`
- 引入页：`/market/:symbol`（`market_detail_page.dart`）
- 涨跌色绑定主题：`statusOk` / `statusDanger`
- 周期切换 / 历史拉取 / 推流追加由 `KlineRepository` 提供（mock 已 ready）

**已知技术债**：

- 推流当前采用 `append-only`（每秒一根新蜡烛），未实现 upsert。真实 WebSocket 接入时需扩展为按 `openTime` 合并未收盘蜡烛
- `KLineEntity.time` 单位为毫秒，映射时用 `Candle.openTime.millisecondsSinceEpoch`，不要混淆为秒

**复核机制**：若后续要叠加多套指标 / 多主图切换 / 深度图，重新评估 k_chart_plus vs 自绘。
