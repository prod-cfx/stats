# quantify-mobile 技术决策记录

按时间倒序记录关键技术选型。每条决策标注：**背景 / 候选 / 判定 / 理由 / 落地范围**。

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
