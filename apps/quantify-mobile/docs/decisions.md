# quantify-mobile 技术决策记录

按时间倒序记录关键技术选型。每条决策标注：**背景 / 候选 / 判定 / 理由 / 落地范围**。

---

## 2026-06-01 · 聚合持仓量 tab 排序按钮：方案 A 移除、对齐设计稿（Issue #1919）

**背景**：`apps/quantify-mobile/lib/pages/market/widgets/agg_open_interest_tab.dart:134-152` 在币种 chips 旁渲染了一个可见排序 `OutlinedButton`（`agg-oi-sort-button`）+ 排序抽屉（`agg-oi-sort-*`，6 指标 desc/asc/none 三态循环）。但设计真源 `design/project/mobile/m-screens-data.jsx` 的 `OpenInterestTab`（`:1245`）渲染层（`return` JSX，`:1285-1318`）**只有币种 chips + 表格**——其 `sortKey/sortDir/sortOpen` state（`:1249-1251`）+ `SORT_OPTS` + `filteredRows` 排序逻辑在设计稿中是**未渲染触发器的死代码**（无任何按钮/抽屉消费它）。即 Flutter 在持仓量 tab **多出**了设计稿未呈现的排序入口。issue 引用的「币股屏 `ScreenCoinStocks` 有完整筛选&排序 sheet」是**另一屏**（且该 sheet 在设计稿中真实渲染），不构成持仓量 tab 保留排序的先例。

**候选**：

| 方案 | 内容 | 取舍 |
|------|------|------|
| A. 严格对齐设计稿（采纳） | 移除持仓量 tab 排序按钮 + 抽屉 + 排序 state；表格按 fixtures 原始顺序渲染（对齐设计稿 `data.rows`）；连带清理仅服务排序的死代码（`OiSortKey` 枚举 / `OiRow.valueFor` / 6 个 `aggSort*` 文案） | 设计稿渲染层无排序入口，Flutter 排序按钮是 app 残留，与设计真源冲突；排序对纯 mock 固定数据无产品价值；对齐 #1799/#1750 已确立的「设计超前/app 残留 → 按设计基线清理」精神；移除后 `agg-oi-list` 渲染（chips + 表格）与设计稿 1:1 一致 |
| B. 视为有意补强 UX 保留 | 保留排序按钮/抽屉，PR 注明对齐扩展 | 与设计真源渲染层冲突，需反向回写设计稿才自洽；排序在固定 mock 数据下无真实价值；保留即把 app 残留固化为基线，与「以设计真源为准」的对齐方向背离 |

**判定**：**采纳方案 A——移除持仓量 tab 排序入口**，使 `agg_open_interest_tab.dart` 渲染层与设计稿 `OpenInterestTab` 一致（币种 chips + 表格，表格按 fixtures 原始顺序）。

**理由**：

1. **以设计真源为准**：设计稿 `OpenInterestTab` 渲染层（`:1285`）明确只输出 chips + 表格，排序 state 是设计稿自身的死代码；Flutter 排序按钮是 app 单方面多出的入口，属未对齐残留而非有意补强。
2. **YAGNI / 无产品价值**：持仓量数据为固定 mock（`kOiData`），排序在无真实数据通道（#1683 聚合数据范畴）下是无意义交互；真实数据接入后排序口径大概率由后端/产品重新定义，提前保留前端 mock 排序是技术债。
3. **KISS / 清理死代码**：排序移除后 `OiSortKey` 枚举、`OiRow.valueFor`、6 个 `aggSort*` 文案再无消费者，一并删除避免留下孤儿死代码（对齐 #1799 移除孤儿模型/文案的处理）。
4. **Never break userspace**：`agg-oi-list` / `agg-oi-row-*` / 表格结构与既有 `agg-subtab-openInterest` 切换路径维持现状，仅移除 `agg-oi-sort-button` / `agg-oi-sort-*`；持仓量数据 `OiRow` 的 `h1/h4/oiVol` 字段保留（设计稿表格数据模型一部分，非排序专属）。

**落地范围**：

- `lib/pages/market/widgets/agg_open_interest_tab.dart`：删 `_SortDir` 枚举、`_sortKey/_sortDir` state、`_sortLabel`/`_pickSort`/`_openSortSheet`/`_sorted`/`_sortIcon`，chips 行去掉排序按钮（`Row`+`Expanded`+`OutlinedButton` → 直接 `AggCoinChips`），表格改用 `data.rows` 原始顺序。
- `lib/data/models/agg_orders_models.dart`：删 `OiRow.valueFor` 方法 + `OiSortKey` 枚举（排序移除后无消费者）。
- `lib/l10n/app_zh.arb` / `app_en.arb`：删 6 个 `aggSortQty/Share/H1/H4/H24/OiVol` 文案，`flutter gen-l10n` 重生成 localizations。
- `test/pages/agg_orders_body_test.dart`：「切到持仓量子 tab」用例排序按钮断言由 `findsOneWidget` 翻转为 `findsNothing`；原「持仓量排序抽屉可选 OI/V」用例改为「无排序按钮/抽屉，表格按原始顺序」守护；AC3 注释同步。
- `README.md`「设计真源」段补 #1919 引用。

**对齐结论（对应 #1919 验收标准逐条）**：

| 验收标准 | 结论 | 依据 |
|---------|------|------|
| [1] 给出 A/B 明确结论并记录原因 | 已满足。结论＝方案 A 移除，记入本节 | 本节 |
| [2] 选 A：移除排序按钮/抽屉后 `agg-oi-list` 渲染与设计稿一致，widget test 同步更新 | 已满足。渲染层＝chips + 表格（对齐 `OpenInterestTab` `:1285`）；test 排序断言翻转为 `findsNothing` | 上「落地范围」 |
| [3] 选 B 分支 | 不适用（采纳 A） | — |
| [4] `dx build quantify --dev` 通过 | 见 PR「已做的验证」段（Flutter app，附 `flutter analyze` / `flutter test` 证据） | 验证段 |

**不变项**：聚合挂单 / 聚合成交量 tab 及其各自交互（视图切换 / 价格精度抽屉 / 来源抽屉 / 占比条）维持现状；币股屏 `ScreenCoinStocks` 的筛选&排序 sheet 不受影响（另一屏，本决策不涉及）。设计稿 `OpenInterestTab` 的排序 state 死代码保留在设计稿中不动（设计侧清理不在本 app issue 范围）。

---

## 2026-06-01 · AI 量化形态裁决 + 5 步 StepBar 向导骨架：方案 B 维持对话中心、向导标 future（Issue #1890，AI 量化对齐批次前置基座）

**背景**：#1890 为本批「AI 量化」对齐工作的**基座 Issue**，要求先裁决形态：设计稿 `design/project/mobile`（`proto.jsx` 串联）把「AI 量化」定义为 **6 屏线性向导**，每屏顶部共享一条 5 步进度指示器 `BtcStepBar`（`m-screens-btconfig.jsx:285`，标签 `:287-289` `确认策略 / 策略脚本 / 回测设置 / 回测 / 部署`，已完成步可点击回跳），屏间「上一步 / 下一步」线性导航；现实现走**对话中心**形态——确认+脚本合并为单页 `/ai/confirm`（无 StepBar）、回测设置是弹层 `backtest_config_sheet.dart`、回测中/结果退化为对话内嵌卡（`qz_backtest_progress_card.dart` / `qz_backtest_result_card.dart`）、部署是弹层 `qz_deploy_sheet.dart`。`qz_backtest_progress_card.dart` 头部注释引用本文件 #1749，说明现 route/sheet 边界是**有意决策**。

**候选**：

| 方案 | 描述 | 取舍 |
|------|------|------|
| A. 对齐设计稿（向导形态） | 新增 `BtcStepBar` 组件 + 整屏路由 `/ai/confirm`→`/ai/script`→`/ai/backtest-config`→`/ai/backtest-run`→`/ai/backtest-result`→`/ai/deploy`，全程共享 StepBar + 上一步/下一步线性导航，推翻 #1749 §3 route↔sheet 边界与 #1751 简化边界 | 5 步向导骨架 + 6 屏 route + StepBar 回跳态全部依赖真实策略代码生成 / 回测引擎产出（#1679/#1682）才有产品价值；未就绪前落 mock 向导骨架，真实接入时大概率重写（步骤序、回跳语义、上下文持有者归属均由真实数据形态决定）；直接推翻 #1749/#1751/#1770/#1771 已反复确立的「对话是唯一会话上下文持有者、回测/部署走 sheet+聊天卡、不新增多步骤 route」边界，破坏现役可走通链路（Never break userspace） |
| B. 维持对话中心、向导标 future（采纳） | 钉死「AI 量化以 app 现有对话中心形态为最终基线」：对话 → `/ai/confirm` → `/ai/backtest-config`（route 承载回测配置弹层）→ 聊天内回测卡 → `QzDeploySheet`；不引入 `BtcStepBar`、不新增 6 屏向导 route、不做屏间线性导航。设计稿 6 屏向导 + 5 步 StepBar 统一标 future。本结论作为后续「AI 量化」单屏对齐 Issue 的前置依据被显式引用 | 对齐 #1749 §3（route↔sheet 硬边界）、#1751（AI 对话直接接回测、不新增独立 route）、#1770（5 步 StepBar + 确认/脚本步骤页同题已采纳暂缓）、#1771（回测中/结果独立页标 future）已建立的统一基线；真实数据通道 #1679/#1682 未就绪，KISS/YAGNI；现役对话链路零破坏 |

**判定**：**采纳方案 B——AI 量化维持对话中心形态为最终基线，6 屏线性向导 + 5 步 `BtcStepBar` 统一标 future，不引入向导骨架与线性导航**。本节作为本批「AI 量化」对齐工作的形态前置结论，supersede #1890「方案 A（对齐设计稿）」分支，并更新 #1749 关于 AI 量化形态的边界为最终结论。

**对齐结论（对应 #1890 验收标准逐条）**：

| 验收标准 | 结论 | 依据 |
|---------|------|------|
| [1] decisions.md 中 AI 量化形态（#1749）决策更新为最终结论 + 理由 | 已满足。结论＝方案 B 维持对话中心，6 屏向导 + StepBar 标 future，记入本节并写明理由；#1749 关于 AI 量化形态的边界由本节钉死为最终结论 | 本节 + #1749 §3 |
| [2] 若采用向导形态：存在 `BtcStepBar` 组件 5 步、当前步高亮、已完成步可点回跳 | 不适用。采纳方案 B，不落地 StepBar；设计稿 `BtcStepBar`（`m-screens-btconfig.jsx:285`）标 future | 本节判定 |
| [3] 若采用向导形态：各屏顶部渲染同一 StepBar | 不适用。同上，不落地 | 本节判定 |
| [4] 屏间「上一步/下一步」线性导航与设计稿一致 | 不适用。维持对话 → route → 聊天卡 → sheet 的现役链路，不引入线性向导导航 | #1749 §3、#1751 |
| [5] 本 Issue 最终形态结论作为后续对齐 Issue 前置依据被显式引用 | 已满足。本节钉死方案 B，README「设计真源」段补 #1890 引用；后续「AI 量化」单屏对齐 Issue 一律以本节为形态前置，不重复论证 | 本节 + README |

**理由**：

1. **真实问题判定**：现 AI 链路（对话 → `/ai/confirm` → `/ai/backtest-config` → 聊天内回测卡 → `QzDeploySheet`）已闭环可走通；「6 屏向导 + StepBar 回跳」是设计超前表达而非阻塞用户的真实缺口。
2. **同题已裁**：#1770 对「5 步 StepBar + 确认/脚本显式步骤页」已采纳方案 B 暂缓、标 future；#1771 对「回测中/结果独立页」同样标 future。#1890 是同一组形态差异的基座汇总，结论必须与既有谱系一致，否则自相矛盾。
3. **依赖未就绪 / YAGNI**：StepBar 回跳态、脚本查看、IF/THEN 规则块均依赖真实策略代码生成与回测接入（#1679/#1682）。mock 阶段堆向导骨架，真实接入后大概率重写。
4. **route↔sheet 硬边界**：#1749 §3 钉死「同一交互不允许 route + sheet 两条入口」，`backtest-config` 以 route 承载弹层视觉。新增 6 屏向导会引入与现链路并行的第二形态，与该边界冲突。
5. **Never break userspace**：维持对话中心对现役 AI 对话流、`backtest_config_sheet.dart`、`QzDeploySheet`、聊天内回测卡及其 widget 测试全部零破坏。

**对后续 Issue 的约束（前置依据）**：本批所有「AI 量化」单屏对齐 Issue（确认策略 / 策略脚本 / 回测设置 / 回测中 / 回测结果 / 部署各屏）一律以本节方案 B 为形态前置——只在现有 route/sheet/聊天卡形态内补齐内容缺口，**不得以「对齐缺口」名义复活 6 屏向导 route、`BtcStepBar` 或屏间线性导航**。设计稿对应屏（`m-screens-confirm.jsx` `ScreenStratConfirm:199` / `ScreenStratScript:704`、`m-screens-btconfig.jsx` `BtcStepBar:285`、`m-screens-backtest.jsx` `ScreenBacktestRun` / `ScreenBacktestResult`、`m-screens-deploy.jsx` 多页结构）保留为 future 高保真表达，不删除、不回流 app，直到 #1679/#1682 接入真实能力后另立 issue 解除本暂缓。

**触发条件**：当 #1679（策略代码生成 / 回测引擎）/ #1682（数据通道）在 app 侧产出真实策略代码与回测结果时，新立「AI 量化向导形态实现」issue，引用本节作为暂缓解除依据，届时统一评估 6 屏 route + `BtcStepBar` + 线性导航 + 结果模型扩展，并同步复核是否解除 #1749 §3 / #1751 的边界。

**落地范围**：仅文档。`apps/quantify-mobile/docs/decisions.md`（本节）+ `apps/quantify-mobile/README.md`「设计真源」段补 #1890 引用。不改 `design/project/mobile/*`、不改 `app_router.dart` / `ai_home_page.dart` / `ai_confirm_page.dart` / `backtest_config_sheet.dart` / `qz_deploy_sheet.dart` / 聊天卡 widget 与 app 代码 / 测试。

---

## 2026-05-30 · 策略详情「用户评价」区块移除：对齐设计稿已删 reviews（Issue #1799）

**背景**：设计稿 `design/project/mobile/m-screens-2.jsx`（`StratDetail`，`:1106` `{/* reviews removed */}`）已移除 reviews（用户评价）区块。Flutter app `apps/quantify-mobile/lib/pages/strategy/strategy_detail_page.dart` 仍保留「用户评价」区块——`strategyReviewsProvider` + section UI（标题 + `_ReviewsSection`/`_ReviewTile`/`_StarsRow`）+ `StrategyReview` 模型 + mock `listReviews`（按 id 派生 3 条 mock 评价）。属设计已删的 app 残留。

**候选**：

| 方案 | 内容 | 取舍 |
|------|------|------|
| A. 移除（采纳） | 删除 detail page reviews 区块 + 三个私有 widget + `StrategyReview` 模型 + `listReviews` 接口/mock/占位 + 两条文案 | 设计稿已显式删除（`{/* reviews removed */}`），app 残留与设计真源冲突；该评价为纯 mock（`Alice/Bob/...` + `Random` 派生星级），无真实数据通道，无产品价值；对齐 #1750/#1770/#1771/#1791 已确立「设计超前/mock-only 内容按设计基线清理」精神，移除使详情页结构（指标网格 + 收益曲线 + 参数 + 近期信号）与 `StratDetail` 对齐 |
| B. 保留 | 维持用户评价区块 | 与设计真源冲突；保留纯 mock 评价无产品价值，真实评价数据通道未立项，维持只是技术债 |

**判定**：**采纳方案 A——移除用户评价区块**，使 app 详情页与设计稿 `StratDetail` 一致。

**落地范围**：

- `lib/pages/strategy/strategy_detail_page.dart`：删 `strategyReviewsProvider`、`reviewsAsync` watch、用户评价标题 + section、`_ReviewsSection`/`_ReviewTile`/`_StarsRow` 三个私有 widget。
- `lib/data/models/strategy_models.dart`：删 `StrategyReview` 模型。
- `lib/data/repositories/strategy_repository.dart` / `lib/data/mock/mock_strategy_repository.dart` / `lib/data/mock/unimplemented_repositories.dart`：删 `listReviews` 接口 + mock 实现 + 占位 override。
- `lib/l10n/app_zh.arb` / `app_en.arb`：删 `strategyDetailReviewsTitle` / `strategyDetailReviewsEmpty`，重生成 localizations。
- `test/pages/strategy_detail_page_test.dart`：去掉 reviews mock 注释（既有断言＝6 指标卡 + 20 信号 + 订阅/分享按钮 + equity，不涉及 reviews，无需改断言）。
- `README.md`「设计真源」段补 #1799 引用。

**对齐结论（对应 #1799 验收标准逐条）**：

| 验收标准 | 结论 | 依据 |
|---------|------|------|
| [1] 产品确认移除，结论记入 `docs/decisions.md` | 已满足。结论＝方案 A 移除，记入本节 | 本节 |
| [2] 删 detail 区块 + 三 widget + `StrategyReview` 模型 + `listReviews` 接口/mock/占位 | 已满足 | 上「落地范围」 |
| [3] 删两条文案并重生成 localizations | 已满足 | arb + `flutter gen-l10n` |
| [4] `flutter analyze` 无新增报错，`flutter test` 既有用例通过 | 已满足。既有 14 qz_* golden + whale_home + app_router /me 失败为 #1785 历史基线，非本次引入 | 验证段 |

**不变项**：详情页其余区块（指标网格 / 收益曲线 / 策略参数 / 近期信号）与底栏「分享 / 载入到对话 / 订阅」维持现状（#1666/#1757）。设计稿 `StratDetail` 不回流 reviews。

---

## 2026-05-30 · 全局视觉精修：打包 Inter/JetBrains Mono、Noto Sans SC 不打包、TabBar saturate 记技术债（Issue #1798）

**背景**：设计稿主字体 Inter / JetBrains Mono / Noto Sans SC，app 此前仅 fallback 不打包；TabBar `saturate(180%)`、Sheet `cubic-bezier(.32,.72,0,1)` 360ms、我的 header 棋盘 logo 未对齐。

**判定**：

1. **打包 Inter（400/500/600/700）+ JetBrains Mono（400/500/700）**，接入 `QzFont.sans`/`QzFont.mono` 与 `ThemeData.fontFamily`。
2. **Noto Sans SC 不打包（技术债结论）**：全量 CJK 16-17MB，bundle 会让 app 下载体积近翻倍；iOS PingFang SC / Android Noto CJK 已内置 CJK，`QzFont.sansFallback` 已 steer 中文字形解析到平台字体。Inter 无 CJK glyph，靠 fallback 链兜底。
3. **Sheet 曲线已移植**：`showModalBottomSheet(sheetAnimationStyle: AnimationStyle(curve: QzCurves.standard, duration: QzCurves.long, ...))`，Flutter 内部 `CurvedAnimation` 消费，无需 `AnimationController`/`TickerProvider`。
4. **我的 header logo**：`_AvatarPlaceholder` 改 `CustomPainter` 画 2×2 棋盘格，不引 `flutter_svg`。
5. **TabBar saturate 记技术债（结论：不追平）**：`BackdropFilter` 只能组合单个 `ImageFilter`；`blur(16px) saturate(180%)` 需额外 `ColorFilter.matrix` 饱和度 pass，无法与 blur 融合为单 filter，二次全屏 backdrop 在常驻 tab bar 上每帧多一次离屏合成，性价比过低。`scheme.tabBlur` tint 已近似偏置饱和度。

**理由**：Latin/mono 才是设计稿真正缺的自定义字形；CJK 体积不可控且平台已覆盖。saturate 无 Flutter 单 filter 等价，强行实现引入每帧离屏合成开销。

**落地范围**：`pubspec.yaml`（fonts）、`assets/fonts/*`、`lib/theme/tokens.dart`（QzFont.sans/mono）、`lib/theme/theme_data.dart`（fontFamily）、`lib/widgets/qz_sheet.dart`（sheetAnimationStyle）、`lib/pages/me/widgets/qz_account_header.dart`（棋盘 painter）、`lib/widgets/qz_bottom_tab_bar.dart`（saturate 结论注释）。

**已知技术债**：

- Noto Sans SC 未打包：极端场景（用户系统缺 CJK 字体）中文可能 fallback 到 Roboto tofu，概率极低；如需 100% 像素一致需后续评估字体子集化（subset CJK 仅常用字）方案。
- 既有 14 个 `qz_*` golden baseline 失败属 #1785 历史基线 drift，本次变更不改变失败集合（branch == main，均 14），baseline 重生归 #1785。

---

## 2026-05-30 · 搜索体验基线：维持现状（market 内联 / long-short 无 / whale-live chip filter + WhaleSearchSheet），全屏 overlay（热门+历史 chips）标 future（Issue #1797）

**背景**：设计稿三屏均含全屏 search overlay（热门 + 历史 chips）——行情列表 `m-screens-2.jsx ScreenTickers`（`:1197`，`openSearch` 全屏覆盖层）、多空比 `m-screens-3.jsx`（`LSCoinTabs` 的 `SearchOverlay`，`hotLabel="热门币种"`）、巨鲸实时 `m-screens-4.jsx WhaleLive`（`WhaleCoinTabs`，`:514` `searching` 币种搜索覆盖层）。`StratSearchOverlay`（`m-screens-2.jsx:243`）给出 overlay 模板：顶部输入框 + 「热门搜索」chips（`STRAT_TRENDING` 静态常量）+ 「搜索历史」chips（`history` useState 种子 + 清空按钮）+ 结果列表。

app 现状核查（**原 issue 描述与代码有出入，以下以代码为准**）：

| 屏 | app 现状 | 设计稿 overlay | 差异性质 |
|----|---------|---------------|---------|
| 行情列表 `market_home_page.dart` | 内联展开搜索框（`market-search-toggle` 切 `market-search-field`，`:101` `_toggleSearch`），symbol 前缀过滤（`:148`），**无热门/历史 chips** | 全屏 overlay + 热门 + 历史 + rich 结果行 | 形态差异（内联 vs 全屏）+ 缺热门/历史 |
| 多空比 `long_short_page.dart` | **无任何搜索/过滤输入**（整文件无 search/filter/TextField） | `LSCoinTabs` 币种搜索 overlay | 完全未落地 |
| 巨鲸实时 `whale_live_tab.dart` | 仅**资产 chip filter strip**（`_symbolFilterKeys=['',BTC,ETH,SOL]`，`:279` `_buildFilterBar`）+ 阈值 pill，**无搜索输入** | `WhaleCoinTabs` 币种搜索 overlay | 币种搜索未落地（但见下「不变项」：巨鲸搜索已由 #1754 `WhaleSearchSheet` 承载） |

**候选**：

| 方案 | 内容 | 取舍 |
|------|------|------|
| A. 对齐：抽象统一全屏 overlay 组件，三处接入 | 新建 `QzSearchOverlay`（输入框 + 热门 chips + 历史 chips + 清空 + 结果列表），替换 market 内联框、给 long-short / whale-live 补币种搜索 overlay；热门=静态种子，历史=session 内存 | 三屏搜索语义**不同**：market 是 symbol 列表过滤，long-short / whale-live 是币种选择（驱动图表/feed 的 coin 维度），whale 另有 `WhaleSearchSheet`（#1754，多类目：地址/标签/资产/交易所/事件）。强抽象一个「统一 overlay」覆盖三种不同语义是过度设计（违反 KISS）；market 现有内联框 + symbol 过滤是已走通可用形态，替换为全屏 overlay 会破坏既有 `market-search-field`/`market-search-toggle` widget keys 与测试（Never break userspace）；热门/历史 chips 的产品价值相对现有可用过滤边际有限，long-short / whale-live 的币种维度已分别由 chip filter / 图表币种参数覆盖核心场景 |
| B. 维持现状 + 全屏 overlay 标 future（采纳） | market 维持内联搜索框 + symbol 过滤；long-short 维持无独立搜索（币种切换走图表参数）；whale-live 维持资产 chip filter + 阈值 pill，巨鲸搜索维持 `WhaleSearchSheet`（#1754）入口；设计稿三屏全屏 overlay + 热门/历史 chips 统一标 future，差异关闭 | 对齐 #1749/#1750/#1756/#1788/#1791/#1794 已建立的「设计超前形态 → 标 future、以 app 现状为基线」规范；零破坏（market 内联搜索、whale chip filter、`WhaleSearchSheet` 均维持现状）；KISS/YAGNI——不为三种不同语义强造一个统一抽象；热门/历史 chips 待真实搜索热度 / 历史持久化通道（#1682 数据范畴）就绪后随币种搜索能力一并评估 |

**判定**：**采纳方案 B——维持现状，全屏 search overlay（热门+历史 chips）统一标记为 future**，不纳入当前 quantify-mobile app 信息架构与验收。

- **行情列表 `market_home_page.dart`** → 维持内联展开搜索框（`market-search-toggle`/`market-search-field`）+ symbol 前缀过滤现状。全屏 overlay + 热门/历史 chips 标 future。
- **多空比 `long_short_page.dart`** → 维持无独立搜索现状（币种维度由图表参数承载）。`LSCoinTabs` 币种搜索 overlay 标 future。
- **巨鲸实时 `whale_live_tab.dart`** → 维持资产 chip filter strip + 阈值 pill 现状。`WhaleCoinTabs` 币种搜索 overlay 标 future；巨鲸搜索能力以既有 `WhaleSearchSheet`（#1754，入口在 `whale_home_page.dart` 顶栏）为唯一基线，不在实时页另开第二条搜索入口（避免 route/sheet/overlay 多入口冲突，见 #1749 §3 边界精神）。
- **热门搜索 / 搜索历史 chips** → future。热门依赖真实搜索热度统计，历史依赖跨会话持久化通道；当前设计稿 overlay 的热门=静态常量、历史=session 种子，落地为纯 mock 无产品价值，真实接入后口径（热度排序、历史去重/上限/清空持久化）大概率重写。

**对齐结论（对应 #1797 验收标准逐条）**：

| 验收标准 | 结论 | 依据 |
|---------|------|------|
| [1] 产品确认搜索基线，结论记入 `docs/decisions.md` | 已满足。基线＝方案 B 维持现状，记入本节 | 本节 |
| [2] 三处搜索现状逐条对照设计稿 overlay，明确对齐 OR future | 已满足。market 内联（维持）/ long-short 无（维持）/ whale-live chip filter + WhaleSearchSheet（维持）；三屏全屏 overlay 均 future | 本节「判定」表 |
| [3] 若标 future：钉死暂缓结论，关联数据依赖与既有 #1754 边界 | 已满足。本节钉死暂缓，热门/历史关联真实搜索热度/历史持久化（#1682 数据范畴），巨鲸搜索以 #1754 `WhaleSearchSheet` 为唯一基线 | 本节 + 后续触发条件 |
| [4] `README.md` 设计真源段补 #1797 引用 | 已满足 | `README.md` 设计真源段 |

**理由**：

1. #1797 目标是「对齐 OR 确认简化标 future」二选一，标 future 分支同样满足验收（验收标准含「若标 future」分支）；非「必须实现」。
2. **KISS / 语义不一致**：三屏搜索语义不同（symbol 列表过滤 vs 币种选择 vs 多类目实体搜索），强抽象一个「统一全屏 overlay」覆盖三者是过度设计；market 内联过滤、whale chip filter、`WhaleSearchSheet` 各自匹配本屏语义且已可用。
3. **YAGNI / 依赖未就绪**：热门 chips 依赖真实搜索热度统计、历史 chips 依赖跨会话持久化，均不在当前范围；设计稿 overlay 的热门=静态种子、历史=session 种子，落地为纯 mock 后真实接入大概率重写。
4. **Never break userspace**：market 现有 `market-search-field`/`market-search-toggle` 内联搜索 + symbol 过滤是可走通的现役形态，配套 widget 测试（`market_home_page_test.dart`）守护；替换为全屏 overlay 会破坏既有 keys 与测试。whale 巨鲸搜索已由 #1754 `WhaleSearchSheet` 承载，在实时页另开搜索入口违反 #1749 §3「同一交互不允许多入口」精神。
5. 与 #1749/#1750/#1756/#1788/#1791/#1794 处理「设计超前 / 真实数据通道未就绪」一致：设计稿保留高保真表达作为 future，app 按真实数据就绪节奏分批落地，文档钉死暂缓结论，避免每个子任务重新论证。

**设计超前 / future 项（不算对齐缺口）**：行情列表 / 多空比 / 巨鲸实时三屏的全屏 search overlay（含「热门搜索」/「搜索历史」chips + rich 结果行）、多空比 `LSCoinTabs` 与巨鲸实时 `WhaleCoinTabs` 的币种搜索 overlay——均待真实搜索热度 / 历史持久化 / 币种搜索数据通道（#1682 数据范畴）就绪后另行立项评估，未就绪前不在 app 落 mock，也不要在后续 PR 以「对齐缺口」名义补。

**不变项**：`market_home_page.dart` 维持内联搜索框（`market-search-toggle`/`market-search-field`）+ symbol 过滤；`long_short_page.dart` 维持无独立搜索；`whale_live_tab.dart` 维持资产 chip filter strip + 阈值 pill；`whale_search_sheet.dart`（#1754 `WhaleSearchSheet`）维持为巨鲸搜索唯一基线，入口在 `whale_home_page.dart` 顶栏。设计稿 `m-screens-2/3/4.jsx` 的全屏 overlay + 热门/历史 chips 表达**保留为 future 能力**，不删除、不回流 app，直到真实搜索数据接入 issue 立项解除。

**后续触发条件**：当真实搜索热度统计 / 跨会话历史持久化 / 币种搜索数据通道（#1682 数据范畴）在 app 侧就绪时，新立「移动端全屏 search overlay 实现」issue，引用本节作为暂缓结论的解除依据，届时统一评估三屏 overlay + 热门/历史 chips 落地，并复核是否与 #1754 `WhaleSearchSheet` 合流。

**落地范围**：仅文档。`apps/quantify-mobile/docs/decisions.md`（本节）+ `apps/quantify-mobile/README.md`「设计真源」段补 #1797 引用。不改 `design/project/mobile/m-screens-2/3/4.jsx`、不改 `market_home_page.dart` / `long_short_page.dart` / `whale_live_tab.dart` / `whale_search_sheet.dart` 与 app 代码 / 测试。

---

## 2026-05-30 · 部署资金配置控件形态：对齐设计稿（滑块 + 3 分渠道通知开关）（Issue #1796）

**背景**：设计稿 `design/project/mobile/m-screens-deploy.jsx`（`DpAllocate:759-931`）资金配置为：投入金额 + 25/50/75/MAX 快捷比例 + 单笔仓位上限**滑块**（DpSlider，10-100 step5，刻度 10/50/100）+ 日内最大亏损**滑块**（1-15 step1，danger 色，刻度 -1/-8/-15）+ **3 个分渠道通知开关**（开仓/平仓/触发止损）。#1772 落地的 `apps/quantify-mobile/lib/widgets/qz_deploy_sheet.dart` `_AllocatePane` 用 stepper（±按钮）替代滑块，3 个通知合并为单一 Switch。#1796 目标：控件形态与设计稿对齐 OR 确认简化并记录。

**候选**：

| 方案 | 内容 | 取舍 |
|------|------|------|
| A. 对齐设计稿（采纳） | stepper → `Slider`（带刻度标签 + 实时值显示），单一 Switch → 3 个分渠道开关（开仓/平仓/触发止损） | 纯前端 mock 控件，无数据通道依赖；滑块为设计稿明确交互，连续调节体验优于 ±5 step 点击；分渠道开关让用户精细控制通知，对齐设计语义；改动仅限单 widget + arb + test，零破坏 |
| B. 维持 stepper + 单开关 | 保留现状，标简化 | stepper 与设计稿交互形态不一致；单一通知开关丢失「按事件类型订阅」语义；本控件无真实后端依赖，不存在「数据未就绪」阻塞，简化无正当理由 |

**判定**：**采纳方案 A——对齐设计稿**。单笔上限 / 日内亏损改 `Slider`（per-trade 10-100 step5、刻度 10%/50%/100%、accent 色；max-loss 1-15 step1、刻度 -1%/-8%/-15%、danger 色），通知拆为 3 个分渠道开关（开仓 / 平仓 / 触发止损，各带「推送 + 应用内消息 / 推送 + 邮件」副标题）。

**落地范围**：

- `lib/widgets/qz_deploy_sheet.dart`：`_AllocatePane` 状态 `bool _notify` → `_notifyOpen/_notifyClose/_notifyStopLoss` 三 bool；`_StepperRow`/`_StepperButton` → `_AllocateSliderRow`（label + 值 + Slider + 刻度）/`_NotifyRow`（分渠道开关行）
- `lib/l10n/app_zh.arb` / `app_en.arb`：删除 `deployAllocateNotifyLabel/Caption`，新增 `deployAllocateNotifySectionLabel` + 3 渠道 `*Label`/`*Caption`
- `test/widgets/qz_deploy_sheet_test.dart`：断言 2 个 Slider + 3 个分渠道开关 key；新增「滑块拖动 + 分渠道开关独立切换」用例
- 保留既有 widget key `deploy-allocate-per-trade` / `deploy-allocate-max-loss` / `deploy-allocate-notify`（Never break userspace，既有测试与外部引用不破坏）

**对齐结论（对应 #1796 验收标准逐条）**：

- [x] 产品确认控件基线 → 采纳方案 A，结论记入本节
- [x] 单笔上限 / 日内亏损改滑块，通知拆为分渠道开关 → 已落地
- [x] 更新 `qz_deploy_sheet_test.dart` → 已加滑块 / 分渠道开关断言与交互用例

---

## 2026-05-30 · 交易详情数据来源切换（聚合/Binance/OKX）：暂缓、标 future（Issue #1794）

**背景**：设计稿 `design/project/mobile/m-screens-3.jsx`（`ScreenTradingDetail`）交易详情头部含数据来源切换——聚合 / Binance / OKX 下拉抽屉，切换驱动行情数据源。Flutter app `apps/quantify-mobile/lib/pages/market/market_detail_page.dart:249` 顶栏副标题固定 `marketDetailSubtitlePerpBinance`（「永续 · Binance」/「Perp · Binance」），无来源切换。#1794 目标是「补来源切换 OR 按聚合数据就绪节奏标 future」二选一，先做产品取舍。

**候选**：

| 方案 | 内容 | 取舍 |
|------|------|------|
| A. mock-first 落地切换 | 顶栏副标题改为可点下拉，提供 聚合 / Binance / OKX 三选项，切换驱动 ticker / kline / orderbook / trades 数据源 | 三个数据源中只有 Binance 单源 mock 就绪；「聚合」源依赖跨所聚合订单簿数据（与 #1750 同一数据范畴，#1750 已将聚合挂单等二级入口标 future）；「OKX」源依赖多交易所实时行情，依赖 Socket.IO 实时推流通道（#1683，阶段 D，OPEN）。当前 `MarketDataRepository` / mock fixtures 无多源切换能力，强行落地需为「聚合」「OKX」堆纯 mock 或固定回落 Binance，切换是无意义的空壳；真实多源接入后数据口径 / 聚合算法 / 源标识大概率重写，违反 YAGNI |
| B. 暂缓，标记 future（采纳） | 维持顶栏固定「永续 · Binance」副标题，数据来源切换标 future，关联数据依赖 #1750（聚合订单簿数据范畴）+ #1683（实时推流通道），待跨所聚合 / 多交易所实时数据就绪后单独立 issue | 对齐 #1750/#1770/#1771/#1791 已建立的「设计超前 / 真实数据通道未就绪 → 标 future」基线；现有单源（Binance）行情链路已走通，零破坏（Never break userspace）；KISS/YAGNI |

**判定**：**采纳方案 B——暂缓，交易详情数据来源切换（聚合/Binance/OKX 下拉）统一标记为 future**，不纳入当前 quantify-mobile app 信息架构与验收。维持 `market_detail_page.dart:249` 顶栏固定 `marketDetailSubtitlePerpBinance`（「永续 · Binance」）副标题。本节仅落文档，不改 app 代码 / 测试、不改设计稿。

**对齐结论（对应 #1794 验收标准逐条）**：

| 验收标准 | 结论 | 依据 |
|---------|------|------|
| [1] 产品确认落地范围，结论记入 `docs/decisions.md` | 已满足。结论＝方案 B 标 future，记入本节 | 本节 |
| [2] 若落地：交易详情头部提供 聚合/Binance/OKX 切换并驱动行情数据源 | 不适用。未落地切换；顶栏维持固定「永续 · Binance」副标题现状 | 本节判定 |
| [3] 若标 future：钉死暂缓结论并关联数据依赖 | 已满足。本节钉死暂缓结论，关联数据依赖 #1750（聚合订单簿数据范畴）+ #1683（实时推流通道），后续触发条件见下 | 本节 + 后续触发条件 |

**理由**：

1. #1794 目标是「补来源切换 / 标 future」二选一，标 future 分支同样满足验收（验收标准末条「若标 future：钉死暂缓结论并关联数据依赖」）；非「必须实现」。
2. **YAGNI / 依赖未就绪**：「聚合」源依赖跨所聚合订单簿数据（#1750 范畴，#1750 已将聚合挂单二级入口标 future），「OKX」等多交易所实时切换依赖真实推流通道 #1683（阶段 D：Socket.IO 接入，OPEN）。三源中仅 Binance 单源 mock 就绪；先实现纯 mock / 空壳切换违反 YAGNI，真实多源接入后聚合算法 / 数据口径 / 源标识大概率重写。
3. **Never break userspace**：现有单源（Binance）的 ticker / kline / orderbook / trades 链路是可走通的现役形态；在多源真实数据尚未就绪前强行加切换不带来用户价值，保持现状对现有行情详情链路零破坏。
4. 与 #1750/#1770/#1771/#1791 处理「设计超前 / 真实数据通道未就绪」一致：设计稿保留高保真表达作为 future 能力，app 按真实数据就绪节奏分批落地，文档钉死暂缓结论，避免每个子任务重新论证。

**后续触发条件**：跨所聚合订单簿数据（#1750 范畴）与多交易所实时推流通道（#1683 阶段 D）任一就绪并明确产品价值后，另行立项评估顶栏数据来源切换；未就绪前不在 app 落 mock / 空壳切换，也不要在后续 PR 以「对齐缺口」名义补。

**不变项**：`market_detail_page.dart:249` 顶栏 `subtitle` 维持 `l10nForBar.marketDetailSubtitlePerpBinance`（zh「永续 · Binance」/ en「Perp · Binance」），不改为可点下拉。本节仅落文档，不改 app 代码 / 测试、不改设计稿。

---

## 2026-05-30 · 巨鲸地址详情 6 tab 重型详情：方案 B 暂缓、标 future（Issue #1791）

> ⚠️ **本节已被 2026-05-31 节 supersede**：暂缓前提（数据通道 #1682 未就绪、只能堆纯 mock）已被 #1858（PR #1864）消除——11 个明细数据模型 + fixtures + l10n 已 merge 到 main。结论反转为「方案 A 落地（mock-first）」，详见下方「2026-05-31 · 巨鲸地址详情 6 tab 重型详情落地」节。本节保留作历史决策记录。

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

## 2026-05-31 · 巨鲸地址详情 6 tab 重型详情落地：决策反转为方案 A（Issue #1791，supersedes 2026-05-30 节）

**背景**：2026-05-30 节采纳「方案 B 暂缓、标 future」，**唯一前提**是 6 tab 明细（现货/永续/挂单/成交/历史 + P&L 时序）依赖真实地址数据通道 #1682，未接入前只能堆纯 mock、真实接入后大概率重写（YAGNI）。**该前提现已不成立**：#1858（PR #1864，已 merge 到 main）已落地完整数据底座——

- 11 个明细数据模型（`lib/data/models/whale_profile_models.dart`）：`WhaleSpotHolding` / `WhalePerpHolding` / `WhaleOpenOrder` / `WhaleRecentTrade` / `WhaleHistOrder` / `WhalePnlPoint` / `WhaleProfileStatCards` / `WhalePerpSummary` / `WhaleStatCardExtra` / `WhaleStatCardDonut`，并扩展 `WhaleProfile` 持有 6 tab 全部明细字段。
- 完整 fixtures（`lib/data/mock/fixtures/whale_profiles.dart`）：已知地址 `0x88e…3a01` + 第二地址 + `buildFallbackWhaleProfile` 全量填充上述明细，与设计稿常量 1:1 对齐。
- 6 tab l10n key 集合（zh/en 双语，tab 标签 + 各列标签 + stat 卡 + 永续偏差段 + PnlChartTitle）。

数据底座既已就绪，「纯 mock、真实接入重写」的暂缓理由消失；落地 6 tab 与 #1751/#1752/#1753 已确立的 **mock-first 分批落地路线**一致——运行期不依赖任何写入方先产生数据（不触发数据流跨越），真实读路径 #1682 接入时仅替换 `whaleProfileProvider` 的 repository 实现，UI / 测试不变。

**候选**：

| 方案 | 内容 | 取舍 |
|------|------|------|
| A. mock-first 落地（采纳） | `whale_profile_page.dart` 重构为 6 tab：基本信息（P&L 图 + 4 stat 卡 + 永续总价值明细）+ 现货/永续/挂单/成交/历史明细列表，消费 #1858 数据模型 | 数据底座（#1858）已 merge，消除原暂缓前提；对齐 mock-first 路线；真实接入仅换 repository，零返工风险；与设计稿 `WhaleProfileDetail` 信息架构一致 |
| B. 维持暂缓 | 保持 hero + 2 segment | 数据已就绪仍标 future 与现实脱节；#1858 投入的模型/fixtures/l10n 闲置；信息维度持续少于设计稿 |

**判定**：**采纳方案 A——落地 6 tab 重型详情**，supersede 2026-05-30 节的暂缓结论。

**对齐结论（对应 #1791 验收标准逐条）**：

| 验收标准 | 结论 | 依据 |
|---------|------|------|
| [1] 产品确认落地范围（全量 / 分批 / future），记入 decisions.md | 已满足。结论＝方案 A 全量落地，记入本节 | 本节 |
| [2] 地址详情提供 基本信息/现货/永续/挂单/成交/历史 tab + P&L 图 + 4 stat 卡 | 已满足。`whale_profile_page.dart` 6 tab + `WhalePnlChart` + `WhaleStatCards`（4 卡）+ `WhalePerpSummaryCard` | 实现 |
| [3] decisions.md 钉死决策反转（#1858 数据底座就绪），README 同步 | 已满足。本节钉死反转 + supersede 标注；README 设计真源段更新 | 本节 + README |

**落地范围**：

- `lib/pages/whale/whale_profile_page.dart`：hero + topbar（保留复制；新增「交易统计」按钮）→ `DefaultTabController`(6) + scrollable `TabBar` + `TabBarView`。基本信息 tab = P&L 卡（静态 pill 行 + `WhalePnlChart`）+ `WhaleStatCards` + `WhalePerpSummaryCard`；其余 5 tab = 明细行列表（带计数 + 空态）。
- 新建 widget：`widgets/whale_pnl_chart.dart`（P&L CustomPaint）、`widgets/whale_stat_cards.dart`（4 stat 卡 + donut）、`widgets/whale_perp_summary_card.dart`（永续总价值明细）、`widgets/whale_detail_rows.dart`（5 个明细行 + 空态）。
- `lib/l10n/app_zh.arb` / `app_en.arb`：补 pill 静态值 / ROI / 交易表现 / 交易次数 / 5 个 tab 空态 key，重生成 localizations。
- `test/pages/whale_profile_page_test.dart`：重写覆盖 6 tab 切换 + 基本信息 tab + 统计弹窗入口 + 复制 + 返回 + fallback 空态。

**Never break userspace**：经核查 `WhaleTradeStatsSheet.show`（#1859/#1866，刚 merge）的唯一调用点是旧 stats segment；移除 segment 会使统计弹窗成死代码。故在 topbar 新增「交易统计」按钮承接该入口，统计弹窗仍可达。

**设计裁剪（KISS / YAGNI）**：mock fixtures 每 tab 固定 3 行，**不实现**设计稿的列排序三态循环 / 币种筛选下拉 / PillSelect 可交互下拉 / 拖拽滚动 tab / refresh / 一键监控 / 分享按钮。pill 仅静态展示当前值（1周 / 仅永续合约 / 总盈亏）。这些交互在固定 mock 数据下无产品价值，真实数据（#1682）接入时再评估。

**交易表现卡 4 指标（#1907，修订 #1858 裁剪）**：交易表现卡补齐设计稿 `PerfCard` `:1050` 的 4 指标（胜率 / 最大回撤 / 已成交订单 / 平仓次数）。最大回撤 / 已成交订单 / 平仓次数为 `WhaleTradeStats` 新增可空字段，当前由 fixtures 占位（对齐设计稿 8202846.96% / 2000 / 1025），真值接入由读路径 #1682 承接。原 #1858「只渲染 model 有的字段」的裁剪在本 issue 推翻：UI 形态先按设计稿补齐，避免真值接入时再改布局。

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
| `/market/long-short` | `DataHubPage(initial: longShort)` | `ls`（`under: market`） |
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

#### 6.1 策略广场列表卡操作基线（Issue #1793）

**背景**：设计稿 `m-screens-2.jsx` `StratCard`（`m-screens-2.jsx:868` `function StratCard`）底栏为双按钮——「载入对话（ghost，`m-screens-2.jsx:957`）」+「运行（`run-strat`，紫色渐变主操作，`m-screens-2.jsx:959`-`969`）」。Flutter 列表卡 `strategy_card_tile.dart` 当前仅渲染「载入对话」紫色渐变实心主按钮（`_LoadConversationButton`），无独立「运行」。#1793 要求确认列表卡是否补「运行」，避免与详情页基线（#1666/#1757，本节 #6）冲突。

**判定**：**列表卡维持现状——单「载入对话」主操作，不补「运行」按钮**，与详情页 #6 决策同源。设计稿 `StratCard` 的 `run-strat` 双按钮与 `StratDetail` 的 `run-strat` 一样仅作视觉探索，不作为 app 验收基线。

**理由**：

1. **与详情页基线一致（Never break userspace）**——详情页（#1666/#1757）已刻意把设计稿 `run-strat`（运行策略）主操作位让给「载入到对话」，不保留独立「运行」。列表卡若反向补「运行」，会让"列表卡有运行、详情页没有"，分裂同一策略的交互模型，破坏用户已习得的心智。
2. **设计稿本身已自洽降级**——`m-screens-2.jsx:959` 中 `run-strat` 的 `onClick` 为 `(onRun || onLoad)`：未接 `onRun` 时直接 fallback 到 `onLoad`（载入对话）。即设计稿原型在无真实"运行"语义时，两个按钮行为收敛为同一动作，补独立「运行」无新增产品价值。
3. **运行=部署，入口已在详情/部署流**——真实"运行/部署"是有资金配置 + 预检查 + 分步部署的重交互（见本文 2026-05-30 一键部署节 / #1772），不适合塞进广场列表卡的 32px 行内按钮；列表卡定位是"快速载入对话试聊"，与运行解耦。

**验收对照（以 #1793 验收标准逐条核对，全部以 app 现状为基线）**：

| # | 验收标准 | 结论 | 证据 |
|---|---------|------|---------|
| [1] | 产品确认列表卡操作基线，结论记入 `docs/decisions.md` | 已满足。基线＝仅「载入对话」，本节 6.1「判定」 | 本节 |
| [2] | 若补运行：补主操作 + 接线 + 测试 | 不适用。判定为维持现状，不补「运行」 | 本节「判定」/「理由」 |
| [3] | 若维持现状：decisions.md 记录与 #1757 一致的结论，差异关闭 | 已满足。本节与 #6（#1666/#1757）同源，明确 `StratCard` `run-strat` 仅视觉探索；差异作为"设计稿 vs app 已对齐"关闭 | 本节 + 本文 #6 |

**不变项**：`strategy_card_tile.dart` 底栏保持单 `_LoadConversationButton`（accent 渐变，key `strategy-card-load-chat-<id>`），文案走 l10n `strategyCardLoadConversation`，点击 → toast → `/ai?loadStrategy=<id>`，与详情页 / 列表页 `_onLoadConversation` 流程统一。本节仅落文档，不改设计稿、不改 app 代码。

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


---

## 2026-06-01 · 发现 tab 下游 profile 详情页设计对齐核对（Issue #1968）

**背景**：发现 tab 对齐系列（#1963–#1967）聚焦发现页主体，未逐项比对其下游 profile 详情页（`lib/pages/whale/whale_profile_page.dart`）。本次对照设计稿 `WhaleProfileDetail`（`design/project/mobile/m-screens-whale-discover.jsx:617`）逐项核验。

**判定**：**已对齐，无需代码改动**。6 tab、基本信息 tab（P&L 图 + 4 stat 卡 + 永续总价值卡）、图表筛选底部抽屉均与设计稿一致；未发现需拆 fix issue 的差异。本节仅落文档，不改设计稿、不改 app 代码。

**逐项对照表**：

| 验收项 | 设计稿位置 | Dart 实现位置 | 结论 |
|--------|-----------|--------------|------|
| 6 tab 存在性 | jsx:728-734 TabBar tab 配置数组 | `whale_profile_page.dart:288` `DefaultTabController(length:6)` + `_TabBar` 六个 `_CountTab`（基本信息/现货持仓/永续合约持仓/挂单/最近成交/历史委托） | 对齐 |
| 现货持仓列/排序 | jsx cfg `现货持仓`（持仓价值/金额/价格 + 币种筛选） | `_SpotTab` left=value/amount, right=price, filterLabel | 对齐 |
| 永续合约列/排序 | jsx cfg `永续合约持仓`（持仓价值/未实现盈亏 + 入场均价/标记价/清算价/保证金/资金费用 更多排序） | `_PerpTab` left=value/pnl, moreSort=entry/mark/liq/margin/funding | 对齐 |
| 挂单列/排序 | jsx cfg `挂单`（时间/价值/数量 + 币种筛选） | `_OrderTab` left=time/value, right=qty | 对齐 |
| 最近成交列/排序 | jsx cfg `最近成交`（时间/数量 + 价格/已平盈亏/费用/起始仓位 更多排序） | `_TradeTab` left=time/qty, moreSort=price/pnl/fee/start | 对齐 |
| 历史委托列/排序 | jsx cfg `历史委托`（时间/数量/价格） | `_HistTab` left=time/qty, right=price | 对齐 |
| 基本信息：P&L 图 | jsx:779-870（标题 + 三 pill + 曲线） | `_BasicTab` `WhalePnlChart`(`whale_profile_page.dart:503`) + 三 `_FilterPill`（period/scope/metric） | 对齐 |
| 基本信息：4 stat 卡 2x2 | jsx:872-905（账户总价值/可用保证金/总持仓价值/交易表现 PerfCard） | `WhaleStatCards` `GridView.count(crossAxisCount:2)`：3 张 `_StatCard`（donut+extras）+ `_PerfCard`（胜率/最大回撤/已成交订单/平仓次数） | 对齐 |
| 基本信息：永续总价值卡 | jsx:907-1011（总价值/平均保证金率/方向偏差/仓位分布/ROI/未实现盈亏） | `WhalePerpSummaryCard`：总价值 + `_Progress` + 双 `_BiasBar` + 多/空 `_ValueBlock` + ROI + 未实现盈亏 | 对齐 |
| 图表筛选底部抽屉 | jsx:925 drawer（时间范围/统计范围/指标，选中打勾 + 取消） | `whale_chart_filter_sheet.dart`：标题 + `_OptionRow`（选中 accent 打勾）+ 取消 | 对齐 |

**差异清单**：无。所有项确认已对齐，无需另开 fix issue。

**复核机制**：若后续设计稿 `WhaleProfileDetail` 调整 tab 列定义 / stat 卡指标 / 抽屉形态，需重跑本核对并更新此表。
