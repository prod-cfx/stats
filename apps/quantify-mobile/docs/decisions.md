# quantify-mobile 技术决策记录

按时间倒序记录关键技术选型。每条决策标注：**背景 / 候选 / 判定 / 理由 / 落地范围**。

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

### 6. 策略详情形态与「载入到对话」主操作（Issue #1666）

**背景**：设计稿 `m-screens-2.jsx` 中 `StratDetail` 以 bottom sheet 形式呈现，主操作为底部「载入到对话」（紫色渐变按钮 + toast + 跳 `/ai`）；Flutter 一直把 `/strategy/:id` 实现为 `StrategyDetailPage`。

**判定**：

- **形态保持 full-screen route**——`/strategy/:id` 命中本节 #3 的硬条件（需要深链 / 浏览器返回栈语义、内容超过半屏、列表卡片 push 进入需保留返回路径），不迁移到 bottom sheet。
- **底部主操作 = 「载入到对话」**——对齐设计稿语义。按钮顺序为「分享（ghost）→ 载入到对话（accent，主操作）→ 订阅」。
- **载入对话流程统一**——复用 `strategy_home_page._onLoadConversation` 的 toast helper：显示 `_LoadConversationToast`，~700ms 后跳 `/ai?loadStrategy=<id>`；timer 在 dispose / 重复点击时安全取消。toast key 与列表页保持一致 `strategy-load-conversation-toast`。

**不变项**：设计稿 `StratDetail` 中已有的「收益曲线 + 统计网格 + 策略参数 + 策略说明 + 用户反馈」内容已在 Flutter 详情页覆盖（#1565），本次不扩展也不删减。

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
