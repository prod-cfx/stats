# quantify-mobile 技术决策记录

按时间倒序记录关键技术选型。每条决策标注：**背景 / 候选 / 判定 / 理由 / 落地范围**。

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
