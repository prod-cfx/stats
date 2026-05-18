import 'package:flutter/material.dart';
import 'package:k_chart_plus/k_chart_plus.dart';

import '../data/models/kline_models.dart';
import '../l10n/app_localizations.dart';
import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';
import 'qz_card.dart';
import 'qz_segmented_tabs.dart';
import 'qz_spinner.dart';

/// 真实 K 线图表。
///
/// 取代 `QzKlinePlaceholder`，封装 `k_chart_plus` 的 `KChartWidget`：
/// - 顶部 `QzSegmentedTabs` 切换 6 个周期（1m / 5m / 15m / 1h / 4h / 1d）
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
  static const List<({String label, KlineInterval value})> intervalOptions =
      <({String label, KlineInterval value})>[
    (label: '1m', value: KlineInterval.m1),
    (label: '5m', value: KlineInterval.m5),
    (label: '15m', value: KlineInterval.m15),
    (label: '1h', value: KlineInterval.h1),
    (label: '4h', value: KlineInterval.h4),
    (label: '1d', value: KlineInterval.d1),
  ];

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
    ];

    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          QzSegmentedTabs(
            options: labels,
            value: currentLabel,
            onChanged: (String label) {
              final KlineInterval next = _intervalOf(label);
              if (next != interval) onIntervalChanged(next);
            },
          ),
          const SizedBox(height: QzSpacing.md),
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
