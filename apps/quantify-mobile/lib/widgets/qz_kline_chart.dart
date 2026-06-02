import 'package:flutter/material.dart';
import 'package:k_chart_plus/k_chart_plus.dart';

import '../data/models/kline_models.dart';
import '../l10n/app_localizations.dart';
import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';
import 'qz_card.dart';
import 'qz_segmented_tabs.dart';
import 'qz_sheet.dart';
import 'qz_spinner.dart';

/// 真实 K 线图表。
///
/// 取代 `QzKlinePlaceholder`，封装 `k_chart_plus` 的 `KChartWidget`：
/// - 顶部 `QzSegmentedTabs` 切换 5 个周期（1m / 15m / 1H / 4H / 1D）+ `更多`
///   入口（对齐设计稿 `m-screens-3.jsx`）
/// - 周期 tab 下方一行 OHLC 文本（O 用常规色、H 用涨色、L/C 用跌色）
/// - 中部 `KChartWidget` 渲染蜡烛 + 成交量；缩放 / 拖动 / 长按十字光标
///   由 `KChartWidget` 内置状态机（`isScale` / `isDrag` / `isLongPress`）处理
/// - 涨跌色绑定主题 `statusOk` / `statusDanger`，背景用 `bgSoft`
///
/// 推流接入方在外部维护 `candles` 列表（append 新蜡烛）。当前阶段不支持
/// upsert 同 `openTime` 的更新——真实 WebSocket 接入时再扩展。
class QzKlineChart extends StatelessWidget {
  const QzKlineChart({
    super.key,
    required this.candles,
    required this.interval,
    required this.onIntervalChanged,
    this.hasError = false,
    this.onRetry,
  });

  /// 周期 label 与枚举的固定映射，UI 顺序 = 业务顺序。
  /// 文案严格对齐设计稿 `m-screens-3.jsx`：`1m / 15m / 1H / 4H / 1D`
  /// （去掉 `5m`，大小写统一为 `1H / 4H / 1D`）。
  static const List<({String label, KlineInterval value})> intervalOptions =
      <({String label, KlineInterval value})>[
    (label: '1m', value: KlineInterval.m1),
    (label: '15m', value: KlineInterval.m15),
    (label: '1H', value: KlineInterval.h1),
    (label: '4H', value: KlineInterval.h4),
    (label: '1D', value: KlineInterval.d1),
  ];

  /// `更多` 入口 label。它不是真实周期，点击时弹出更多周期选择 sheet，
  /// 不参与 `intervalOptions` 的选中态映射。
  static const String moreLabel = '更多';

  static const double chartHeight = 320;

  final List<Candle> candles;
  final KlineInterval interval;
  final ValueChanged<KlineInterval> onIntervalChanged;

  /// 加载失败标志。`true` 时显示错误提示 + 重试入口；
  /// `false` 且 `candles` 为空时显示 [QzSpinner]（加载中）。
  final bool hasError;

  /// 错误状态下的重试回调；为 null 时仅展示文案不显示按钮。
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final String currentLabel = _labelOf(interval);
    final List<String> labels = <String>[
      for (final option in intervalOptions) option.label,
      moreLabel,
    ];

    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          QzSegmentedTabs(
            options: labels,
            value: currentLabel,
            onChanged: (String label) {
              if (label == moreLabel) {
                _showMoreIntervals(context, c, l10n);
                return;
              }
              final KlineInterval next = _intervalOf(label);
              if (next != interval) onIntervalChanged(next);
            },
          ),
          const SizedBox(height: QzSpacing.sm),
          _buildOhlcRow(c),
          const SizedBox(height: QzSpacing.sm),
          SizedBox(
            height: chartHeight,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: c.bgSoft,
                borderRadius: BorderRadius.circular(QzRadii.card),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(QzRadii.card),
                child: _buildBody(c, l10n),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// K 线上方 OHLC 行（对齐设计稿 `m-screens-3.jsx` candle 上方 OHLC 块）。
  /// 取最新一根蜡烛：O 用常规文本色，H 用涨色，L 用跌色，C 按收盘相对开盘
  /// 着色（涨用涨色、跌/平用跌色，与设计稿默认收跌着色一致）。
  /// 无数据时各值用占位符 `--`，保持布局稳定不报错。
  Widget _buildOhlcRow(QzColorScheme c) {
    final Candle? last = candles.isEmpty ? null : candles.last;
    final Color closeColor = (last != null && last.close >= last.open)
        ? c.statusOk
        : c.statusDanger;
    return Row(
      children: <Widget>[
        _ohlcItem(c, 'O', _fmt(last?.open), c.text),
        const SizedBox(width: QzSpacing.md),
        _ohlcItem(c, 'H', _fmt(last?.high), c.statusOk),
        const SizedBox(width: QzSpacing.md),
        _ohlcItem(c, 'L', _fmt(last?.low), c.statusDanger),
        const SizedBox(width: QzSpacing.md),
        _ohlcItem(c, 'C', _fmt(last?.close), closeColor),
      ],
    );
  }

  Widget _ohlcItem(QzColorScheme c, String label, String value, Color valueColor) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(
            color: c.textDim,
            fontSize: 10,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }

  static String _fmt(double? value) =>
      value == null ? '--' : value.toStringAsFixed(2);

  /// `更多` 周期入口：当前无更多档位，弹出占位反馈 sheet（满足"无更多周期时
  /// 至少不报错且有占位反馈"的验收要求）。后续接入新周期时在此扩展列表。
  void _showMoreIntervals(
    BuildContext context,
    QzColorScheme c,
    AppLocalizations l10n,
  ) {
    QzSheet.show<void>(
      context: context,
      builder: (BuildContext ctx) => Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.lg,
          vertical: QzSpacing.xl,
        ),
        child: Text(
          l10n.klineMoreIntervalsEmpty,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: c.textDim,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildBody(QzColorScheme c, AppLocalizations l10n) {
    if (hasError) return _buildError(c, l10n);
    if (candles.isEmpty) return const Center(child: QzSpinner());
    return _buildChart(c);
  }

  /// 错误态：文字 + 可选重试按钮，与 `QzEmptyState` 风格不同（chart 区域内嵌）。
  Widget _buildError(QzColorScheme c, AppLocalizations l10n) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            l10n.klineLoadError,
            style: TextStyle(
              color: c.textDim,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (onRetry != null) ...<Widget>[
            const SizedBox(height: QzSpacing.sm),
            TextButton(
              onPressed: onRetry,
              child: Text(l10n.commonRetry, style: TextStyle(color: c.accent)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildChart(QzColorScheme c) {
    final List<KLineEntity> data = <KLineEntity>[
      for (final Candle candle in candles) _mapToEntity(candle),
    ];
    return KChartWidget(
      data,
      _sharedStyle,
      _colorsFor(c),
      isTrendLine: false,
      isLine: false,
      mainIndicators: const <MainIndicator>[],
      secondaryIndicators: const <SecondaryIndicator>[],
      volHidden: false,
      isTapShowInfoDialog: false,
      hideGrid: false,
      showNowPrice: true,
      // 当前不展示长按 detail 框（detailBuilder 返回空 widget），
      // 因此关闭 info dialog 避免渲染空浮层。
      showInfoDialog: false,
      materialInfoDialog: false,
      fixedLength: 2,
      mBaseHeight: chartHeight - 60,
      verticalTextAlignment: VerticalTextAlignment.right,
      detailBuilder: _emptyDetailBuilder,
    );
  }

  /// 共享的 `KChartStyle` 实例。当前所有主题/周期共用同一份默认样式；
  /// 把它声明为 `static final` 避免 1Hz 推流场景下每帧重新构造。
  static final KChartStyle _sharedStyle = KChartStyle();

  /// 共享 detailBuilder：原型阶段不展示 detail，永远返回空 widget。
  /// 提取为 static 避免每次 build 闭包 alloc。
  static Widget _emptyDetailBuilder(KLineEntity _) => const SizedBox.shrink();

  /// 单槽 memo：记住最近一次见到的 scheme（按 `identical` 比较）及其对应
  /// `KChartColors`。`QzColorScheme` 未覆盖 `==`/`hashCode`，用 `Map` 做
  /// 缓存会因 identity 漂移导致无界增长；改用单槽 + identical 比较，
  /// 1Hz 推流场景下 Theme 引用稳定时直接命中，主题切换或重建时只多构造
  /// 一次 KChartColors，无任何无界资源。
  static QzColorScheme? _cachedScheme;
  static KChartColors? _cachedColors;

  static KChartColors _colorsFor(QzColorScheme c) {
    if (identical(_cachedScheme, c) && _cachedColors != null) {
      return _cachedColors!;
    }
    final KChartColors built = _buildColors(c);
    _cachedScheme = c;
    _cachedColors = built;
    return built;
  }

  /// 把本地 `Candle` 映射为 `k_chart_plus` 的 `KLineEntity`。
  ///
  /// 实证（读取 `k_chart_plus-1.0.4` 源码）：
  /// - `time` 单位是毫秒（`fromJson` 中把秒级 id `* 1000`）
  /// - 字段名是 `vol`（不是 `volume`）
  /// - `amount`（成交额）≈ `vol * close`
  static KLineEntity _mapToEntity(Candle candle) {
    return KLineEntity.fromCustom(
      time: candle.openTime.millisecondsSinceEpoch,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      vol: candle.volume,
      amount: candle.volume * candle.close,
    );
  }

  /// 构造主题感知的 `KChartColors`。`KChartColors` 是不可变 const 构造，
  /// 必须一次性把所有需要的颜色传进去。
  static KChartColors _buildColors(QzColorScheme c) {
    return KChartColors(
      bgColor: c.bgSoft,
      upColor: c.statusOk,
      dnColor: c.statusDanger,
      volUpColor: c.statusOk,
      volDnColor: c.statusDanger,
      volColor: c.textDim,
      kLineColor: c.statusOk,
      kLineFillColors: <Color>[
        c.statusOk.withValues(alpha: 0.25),
        c.statusOk.withValues(alpha: 0),
      ],
      defaultTextColor: c.textDim,
      nowPriceUpColor: c.statusOk,
      nowPriceDnColor: c.statusDanger,
      gridColor: c.borderSoft,
      crossColor: c.textDim,
      crossTextColor: c.text,
      selectFillColor: c.bgElev,
      selectBorderColor: c.borderStrong,
      maxColor: c.text,
      minColor: c.text,
      trendLineColor: c.accent,
    );
  }

  static String _labelOf(KlineInterval interval) {
    for (final option in intervalOptions) {
      if (option.value == interval) return option.label;
    }
    return intervalOptions.first.label;
  }

  static KlineInterval _intervalOf(String label) {
    for (final option in intervalOptions) {
      if (option.label == label) return option.value;
    }
    // fallback 与 _labelOf 保持对称：均回退到 intervalOptions.first
    return intervalOptions.first.value;
  }
}
