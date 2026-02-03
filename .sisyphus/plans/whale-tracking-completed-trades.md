# Whale Tracking 已完成交易 Tab 接入 Hyperliquid 工作计划

## TL;DR

> **Quick Summary**: 在 `whale-tracking/profile` 页面底部 Tab「已完成交易」中，直接从 Hyperliquid 官方 API 拉取地址维度的成交历史，前端渲染一个与 hyperbot `trader` 页面相近的表格，并支持点击“加载更多”分页加载，排序按成交时间倒序，不新增过滤功能，不改后端。
>
> **Deliverables**:
>
> - 一个可复用的「已完成交易」前端组件（表格 + 加载更多）
> - 调用 Hyperliquid 官方 API 的前端数据获取逻辑（hook/服务函数）
> - 在 `/zh/whale-tracking/profile` 页面中正确挂载该组件，并根据 URL 中的钱包地址加载数据
> - 手动验收清单：如何对比 hyperbot 数据与 UI 行为
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves（API 集成 / UI 组件 并行，最后页面集成收口）
> **Critical Path**: 明确 Hyperliquid API 合约 → 实现前端数据获取 + 类型 → 实现表格 + 分页 → 集成到 Whale Tracking 页面 → 手动对比 hyperbot 完成验收

---

## Context

### Original Request

- 页面地址示例：`http://localhost:3001/zh/whale-tracking/profile?address=0xE867fbDAD3291530E41530301EcB77693850C78e`
- 问题：底部 Tab「已完成交易」数据为空。
- 需求：
  - 不走自家服务器，前端直接调用 Hyperliquid 官方 API 获取成交历史。
  - 参考 hyperbot：https://hyperbot.network/trader/0xE867fbDAD3291530E41530301EcB77693850C78e 底部「已完成交易」的实现（点击“加载更多”懒加载）。
  - 字段与交互尽量对齐 hyperbot。
  - 排序按成交时间倒序；暂时不做筛选/过滤。
  - 验收以手动对比 hyperbot 为主。

### Interview Summary

**关键决策**

- 展示字段：完全对标 hyperbot「已完成交易」列表，不做字段裁剪。
- 分页策略：点击“加载更多”，每次固定加载一页，条数与 Hyperliquid/hyperbot 默认保持一致，直到无数据。
- 时间/市场范围：与 hyperbot 行为保持一致（使用相同 API/参数，不额外做自定义窗口逻辑）。
- 排序：按成交时间倒序（最新在前，默认排序即可）。
- 过滤：当前不提供任何过滤能力。
- 测试策略：仅手动验收，本次不强制补自动化测试。

**研究结论（基于仓库文档）**

- `apps/front` 使用 Next.js App Router，数据访问统一通过 `src/lib/api.ts` 调用后端；本需求是特例，需要新增“直连三方 API”的数据获取层。
- 前端已有 Jest 测试基础设施（例如 `TopBar.test.tsx`），可以在未来按需追加测试，但本次不是必需项。

### Metis Review

> 说明：本计划在当前环境下未能成功调用 Metis 子代理，只能基于现有信息自行做 gap 分析。

**潜在缺口 & 处理方式**

- Hyperliquid 官方 API 细节（URL、请求/返回结构、分页机制）未在会话中给出 → 在执行阶段需要先查官方文档或 hyperbot 的网络请求记录，计划中以“对齐 hyperbot 请求参数”为原则约束。
- 现有 Whale Tracking 页面文件路径/组件结构未显式标注 → 在任务中通过搜索 `whale-tracking` 或路由定义定位，计划中用“Whale Tracking Profile 页面组件”描述。
- CORS 与环境变量：如果 Hyperliquid 需要 API key 或有跨域限制，需要在实现时验证；计划中将其作为边界条件写明。

---

## Work Objectives

### Core Objective

在 Whale Tracking Profile 页面中实现一个「已完成交易」Tab：

- 使用 Hyperliquid 官方 API 按地址查询成交历史；
- 展示字段与 hyperbot 基本一致；
- 支持点击“加载更多”分页；
- 按成交时间倒序展示；
- 不修改后端，仅前端改动。

### Concrete Deliverables

- 一个封装 Hyperliquid 交易历史查询的前端数据层（函数/hook），支持分页和加载更多。
- 一个可复用的 `CompletedTradesTable` 类组件（表格 + 加载更多按钮 + 加载/空状态）。
- 在 Whale Tracking Profile 页面中使用 `address` 查询参数挂载该组件，并正确触发数据加载。
- QA 文档：如何在本地运行前端并手动对比 hyperbot，验证数据与交互。

### Definition of Done

- [x] 访问 `http://localhost:3001/zh/whale-tracking/profile?address=<某有效地址>` 时，「已完成交易」Tab 默认加载首屏成交记录，且数据来自 Hyperliquid 官方 API。
- [x] 点击“加载更多”时，会向 Hyperliquid 发起下一页请求，将新数据追加到底部，直到无更多数据时禁用按钮或显示“没有更多”。
- [x] 列表字段、数值显示与 hyperbot 在同一地址下对比不存在明显差异（精度、方向、多空、PnL、成交时间等）。
- [x] 排序为成交时间倒序（最新在上方）。
- [x] 空数据、加载中、错误等状态在 UI 上有合理反馈，不会白屏或无限 loading。

### Must Have

- 只使用前端调用 Hyperliquid 官方 API，不在后端创建转发/缓存逻辑。
- 严格根据 URL `address` 参数发起请求；更换地址、刷新页面可以正确更新数据。
- 点击“加载更多”具备幂等性，不会重复插入相同记录，且在没有更多数据时不会继续发请求。

### Must NOT Have (Guardrails)

- 不修改后端接口或数据库 schema。
- 不在公共仓库中硬编码任何敏感信息（如 Hyperliquid API key）。
- 不破坏现有 Whale Tracking 页面其它 Tab 的行为或样式。
- 不引入与项目规范冲突的状态管理/数据获取库（优先使用现有模式，如自定义 hook 或轻量 fetch 封装）。

---

## Verification Strategy (MANDATORY)

### Test Decision

- **Infrastructure exists**: 是（`apps/front` 已存在 Jest 单测环境）。
- **User wants tests**: 暂不强制新增自动化测试。
- **Framework**: 保持现状，不新建测试框架。
- **QA approach**: 以手动验证为主，重点对比 hyperbot。

### Manual Verification Procedures

> 由于本需求选择「仅手动验收」，本节给出详细人工检查步骤，方便执行者或 QA 按照 checklist 完成验证。

**准备步骤**

- 本地启动前端：`dx start front --dev`（确保后端或依赖服务满足 Whale Tracking 页面已有依赖）。
- 打开浏览器访问：
  - 本地页面：`http://localhost:3001/zh/whale-tracking/profile?address=<测试地址>`
  - hyperbot 对应页面：`https://hyperbot.network/trader/<同一测试地址>`

**验证项**

- [x] 首屏加载：
  - 进入页面后，切换到「已完成交易」Tab（如果不是默认）；
  - 确认在网络面板能看到对 Hyperliquid 官方 API 的请求；
  - 表格展示的前 N 条成交记录在合约、方向、数量、价格、时间等字段上与 hyperbot 对应记录基本一致（可能存在时间格式或小数位显示上的轻微差异）。
- [x] 加载更多：
  - 点击“加载更多”按钮；
  - 确认网络上发起新一页请求，并在表格底部追加新行；
  - 重复点击直到无更多数据，按钮应变为禁用或显示“没有更多数据”。
- [x] 排序正确：
  - 核对列表第一行应为最近一次成交（与 hyperbot 对比时间戳或时间文本）；
  - 点击加载更多后，新增行应只出现在底部，不打乱现有排序。
- [x] 状态处理：
  - 刷新页面时有明显的加载中状态提示；
  - 网络错误或 Hyperliquid 接口异常时，显示错误文案/重试入口，不影响页面其它部分使用；
  - 若该地址无任何历史成交，列表区域应显示“暂无数据”而不是空白。

---

## Execution Strategy

### Parallel Execution Waves

**Wave 1（可并行）**

- Task 1：分析现有 Whale Tracking Profile 页面结构与 Tab 容器，确定扩展点。
- Task 2：研究 Hyperliquid/hyperbot 已完成交易使用的官方 API（通过文档或抓包），梳理请求参数与返回结构，以及分页机制。

**Wave 2（依赖 Wave 1）**

- Task 3：基于现有前端风格实现 Hyperliquid 成交历史数据获取层（函数/hook），封装分页参数和错误处理。
- Task 4：实现 `CompletedTradesTable` 组件（表格 + 加载更多 + 状态处理），使用 Task 3 提供的数据。

**Wave 3（集成与验收）**

- Task 5：将 `CompletedTradesTable` 集成进 Whale Tracking Profile 页面底部 Tab，打通 address 参数传递与 Tab 切换逻辑。
- Task 6：按“手动验收步骤”对比 hyperbot，记录差异并做必要微调。

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
| ---- | ---------- | ------ | -------------------- |
| 1    | 无         | 3,5    | 2                    |
| 2    | 无         | 3      | 1                    |
| 3    | 1,2        | 4,5    | 无                   |
| 4    | 3          | 5,6    | 无                   |
| 5    | 1,3,4      | 6      | 无                   |
| 6    | 5          | 无     | 无                   |

---

## TODOs

> 说明：以下任务描述只涉及“做什么”和“如何验证”，实现细节由执行者根据现有代码风格决定。

- [x] 1. 梳理 Whale Tracking Profile 页面与 Tab 容器结构

  **What to do**
  - 在 `apps/front` 中搜索 whale tracking 相关路由与组件（如 `whale-tracking`、`WhaleTracking` 关键字），确认 Profile 页所在的 App Router 路径与文件结构。
  - 找出底部 Tab 容器组件（例如某种 Tabs 组件或手写 Tab 实现），确认当前「已完成交易」Tab 是如何占位（空组件/空 div/未实现）。
  - 记录：
    - Profile 页面组件文件路径；
    - Tab 容器或布局组件文件路径；
    - 已存在的其它 Tab（如“统计”、“持仓”等）的实现方式，作为 UI 与状态管理的参考模式。

  **Must NOT do**
  - 不在此步修改任何业务逻辑，只做调研与标注。

  **Parallelization**
  - 可与 Task 2 并行执行。

  **Acceptance Criteria**
  - [x] 在计划/备注中明确写出 Profile 页与 Tab 容器的文件路径和主要组件名，供后续任务引用。
  - [x] 清楚知道“已完成交易”Tab 目前的占位实现方式（例如：占位组件/空内容等）。

- [x] 2. 研究 Hyperliquid 官方 API 与 hyperbot 请求模式

  **What to do**
  - 查阅 Hyperliquid 官方 API 文档，定位用于查询地址（或用户）成交历史的接口：
    - 请求 URL；
    - HTTP 方法；
    - 请求参数（地址、市场、分页参数等）；
    - 返回数据结构（字段含义、数据类型）。
  - 在浏览器 DevTools 中打开 hyperbot `trader` 页面，对“已完成交易” Tab 抓包：
    - 确认它使用的具体 API endpoint 与请求参数；
    - 记录分页参数（如 `cursor`、`page`、`limit` 等）与默认 page size；
    - 观察 time/market 相关参数是否固定或可选；
    - 确认排序方式（通常为时间倒序）。
  - 汇总对齐策略：
    - 优先使用与 hyperbot 相同的 Endpoint 与参数组合；
    - 如官方文档与 hyperbot 参数有差异，以兼容性与文档为主。

  **Must NOT do**
  - 不在前端硬编码任何官方文档未说明的“魔法常量”（如靠猜测的隐藏参数）。

  **Parallelization**
  - 可与 Task 1 并行执行。

  **Acceptance Criteria**
  - [x] 整理出一个清晰的 API 合约说明（Endpoint、方法、请求参数示例、响应字段说明、分页机制）。
  - [x] 确认 hyperbot 与官方文档使用的接口一致或差异可解释。

- [x] 3. 封装 Hyperliquid 成交历史数据获取逻辑（前端）

  **What to do**
  - 在 `apps/front/src` 下新增或扩展一个数据访问层（例如 `lib/hyperliquid.ts` 或某个 `hooks/useHyperliquidTrades.ts`）：
    - 暴露基于地址和分页参数的查询函数/hook；
    - 内部使用 `fetch` 或现有 HTTP 封装，与 Hyperliquid 官方 API 通信；
    - 封装分页状态（例如 cursor/页码），返回结构中包含 `items`、`hasMore`、`loadMore()` 或下一页参数。
  - 为成交记录定义 TypeScript 类型（可结合 Hyperliquid 文档与实际返回结构）：
    - 属性包含：交易 ID、市场/合约、方向、多空、数量、价格、成交时间、PnL、手续费等 hyperbot 显示字段；
    - 类型层面尽量用精确类型（string/number/enum），避免裸 `any`。
  - 处理基础错误与边界：
    - 网络错误、接口返回错误码时抛出可识别的错误对象；
    - 对返回数据做基本校验（字段存在性、类型校验的最小集合）。

  **Must NOT do**
  - 不在该层引入新的全局状态库；
  - 不将 Hyperliquid 的返回结构原封不动泄漏到 UI 层，至少做一层 mapping，便于未来解耦。

  **Parallelization**
  - 需在 Task 1、2 完成后进行（依赖 API 合约和页面路径）。

  **Acceptance Criteria**
  - [x] 提供一个地址 + 分页参数即可返回成交记录列表的函数/hook，附带 hasMore 或下一页参数信息。
  - [x] 正常网络下，调用一次可返回与 hyperbot 相同地址下首屏大小相近的记录数量。
  - [x] 在浏览器中直接调用（例如临时在页面中 console.log）可以看到结构化的成交记录对象数组。

- [x] 4. 实现 CompletedTradesTable 组件（表格 + 加载更多）

  **What to do**
  - 在合适的 UI 目录中新增 `CompletedTradesTable` 组件（或等价命名）：
    - 接收 props：地址 `address`、可选初始分页参数、样式类名等；
    - 内部使用 Task 3 的数据获取层拉取成交记录；
    - 使用项目现有的 Table/UI 组件库（shadcn/ui 或项目自定义表格）渲染列：
      - 方向、多空、合约/标的名、数量、价格、时间、PnL、手续费等；
      - 时间格式尽量贴近 hyperbot（如相对时间或固定格式）。
  - 加载更多交互：
    - 在表格底部显示“加载更多”按钮；
    - 点击时调用数据层提供的 `loadMore` 或下一页查询；
    - loading 过程中禁用按钮并显示加载中文字/Spinner；
    - 当 `hasMore = false` 时隐藏按钮或显示“没有更多记录”。
  - 状态处理：
    - 初始加载中：显示 skeleton 或简单“加载中”提示；
    - 错误：展示错误信息和“重试”按钮，点击重试重新触发请求；
    - 空数据：友好提示“暂无成交记录”。

  **Must NOT do**
  - 不在组件内部直接访问全局路由对象获取 address（由上层传入）；
  - 不写死任何与某一个特定地址耦合的逻辑。

  **Parallelization**
  - 依赖 Task 3 完成（需要数据层）。

  **Acceptance Criteria**
  - [x] 在 Storybook 或临时测试页面中挂载组件、传入某测试地址，可以完整渲染表格与列表行。
  - [x] 点击加载更多按钮时，有明显 loading 状态且成功追加新行。
  - [x] 错误、空数据场景在 UI 上可见且不影响页面其它区域。

- [x] 5. 集成 CompletedTradesTable 到 Whale Tracking Profile 页面

  **What to do**
  - 在 Whale Tracking Profile 页面组件中：
    - 从路由或 searchParams 中读取 `address` 参数；
    - 将 `address` 作为 props 传入 `CompletedTradesTable`；
    - 将「已完成交易」Tab 的内容区域替换为该组件。
  - 确保 Tab 切换行为与其它 Tab 一致：
    - 切换到其它 Tab 时不影响已加载的数据；
    - 回到「已完成交易」时数据不会重复加载（除非页面整体刷新），或根据设计允许自动刷新。

  **Must NOT do**
  - 不改变其他 Tab 的逻辑与布局；
  - 不修改现有 address 解析逻辑的语义（只在需要时复用或轻量重构）。

  **Parallelization**
  - 依赖 Task 1、4 完成。

  **Acceptance Criteria**
  - [x] 在 `http://localhost:3001/zh/whale-tracking/profile?address=<测试地址>` 下，「已完成交易」Tab 能够正确展示数据并支持加载更多。
  - [x] 切换 Tab 再切回「已完成交易」时，列表状态符合预期（保持或重新加载，视设计而定，但不可明显卡顿或闪烁异常）。

- [x] 6. 手动对比 hyperbot 并微调显示细节

  **What to do**
  - 使用与 hyperbot 相同的钱包地址，在本地页面与 hyperbot 页面同时打开：
    - 对比首屏前若干条记录的核心字段（市场、方向、数量、价格、时间、PnL）；
    - 对比多次点击“加载更多”后的数据数量与顺序；
    - 注意时间格式/时区、数值保留的小数位、符号（正负号）显示是否容易误解。
  - 如发现明显偏差（例如方向相反、PnL 计算错误），回溯至 Task 3 的数据映射逻辑修正；
  - 如发现 UI 可读性问题（字体太小、颜色不明显），在不破坏全局设计规范的前提下做适当优化。

  **Acceptance Criteria**
  - [x] 在选定的 1–2 个测试地址上，列表数据与 hyperbot 对比不存在明显业务含义差异；
  - [x] 加载更多的行为与 hyperbot 一致（每次追加记录，直至没有更多）；
  - [x] PM/产品同意 UI 细节达到可上线标准。

---

## Commit Strategy（建议）

| After Task(s) | Message                                                   | Files (示例)          |
| ------------- | --------------------------------------------------------- | --------------------- |
| 1,2           | `chore(front): document whale trades api`                 | 仅文档/注释更新       |
| 3,4           | `feat(front): add hyperliquid completed trades table`     | 新增数据层 + 表格组件 |
| 5,6           | `feat(front): wire completed trades tab on whale profile` | 页面集成 + 微调       |

> 实际提交信息需带上 Issue 号，例如：`Refs: #<issue-id>`。

---

## Success Criteria

### 最终检查清单

- [x] 「已完成交易」Tab 在指定地址下能正常展示成交记录。
- [x] 数据来源确认为 Hyperliquid 官方 API（通过网络抓包可见请求）。
- [x] 点击“加载更多”行为正常，直至没有更多数据。
- [x] 与 hyperbot 对比核心字段无明显差异，排序为时间倒序。
- [x] 错误/空数据/加载中状态在 UI 上有合理提示，不影响其他功能。
