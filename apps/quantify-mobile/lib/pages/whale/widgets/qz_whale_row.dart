import 'package:flutter/material.dart';

import '../../../data/models/whale_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 巨鲸逐笔持仓推送卡（issue #1985）。
///
/// 三行结构（对齐设计稿 `m-screens-4.jsx` 的 `WhaleRow`）：
/// - Row1：地址 + 商人标签(traderTag) + fresh 圆点 + 相对时间。
/// - Row2：币种 + 全/逐仓(mode) + 多/空胶囊(side 色) + 杠杆(null→`--`)。
/// - Row3：持仓价值/数量 · 开盘价 · 胜率（色阶 ≥70 涨 / ≥50 警示 / <50 跌，issue #1983）。
///
/// 兼容性（Never break userspace）：
/// - 保留 [formatAmountUsd] / [formatRelativeTime] / [winRateColor] / [formatWinRate]
///   静态方法签名（live tab #1983 胜率排序依赖 `event.winRate`）。
/// - 构造参数 `event` / `highlight` / `now` / `displayTimestamp` 不变。
/// - 持仓字段（winRate 以外）缺省时优雅降级：显示 `--` 或隐藏胶囊，不抛异常。
///
/// 相对时间：当外部提供 `displayTimestamp` 时基于它计算（issue #1602），否则
/// 回退 `event.timestamp`；`now` 由外部注入避免测试 flake。
class QzWhaleRow extends StatelessWidget {
  const QzWhaleRow({
    super.key,
    required this.event,
    this.highlight = false,
    DateTime? now,
    this.displayTimestamp,
    this.onOpen,
    this.onStats,
  }) : _now = now;

  final WhaleEvent event;
  final bool highlight;
  final DateTime? _now;

  /// 可选：相对时间渲染基于此 timestamp 而非 `event.timestamp`。
  final DateTime? displayTimestamp;

  /// 点击地址进入巨鲸地址详情。
  final VoidCallback? onOpen;

  /// 点击右上角趋势图标进入交易统计弹层。
  final VoidCallback? onStats;

  static const String _dash = '--';

  /// 暴露给测试的纯函数：金额格式化为 `$1.25M` / `$12.5M` / `$320K`。
  static String formatAmountUsd(double amountUsd) {
    if (amountUsd >= 1_000_000) {
      return '\$${(amountUsd / 1_000_000).toStringAsFixed(2)}M';
    }
    if (amountUsd >= 1_000) {
      return '\$${(amountUsd / 1_000).toStringAsFixed(0)}K';
    }
    return '\$${amountUsd.toStringAsFixed(0)}';
  }

  /// 暴露给测试的纯函数：开盘价格式化。
  /// - ≥1000：千分位整数（如 `75,763`）。
  /// - <1000：保留 2 位小数（如 `83.70`）。
  static String formatPrice(double price) {
    if (price >= 1000) {
      final String intStr = price.round().toString();
      final StringBuffer buf = StringBuffer();
      final int len = intStr.length;
      for (int i = 0; i < len; i++) {
        if (i > 0 && (len - i) % 3 == 0) buf.write(',');
        buf.write(intStr[i]);
      }
      return buf.toString();
    }
    return price.toStringAsFixed(2);
  }

  /// 暴露给测试的纯函数：胜率阈值着色（issue #1983 / #1985）。
  /// 绿 ≥70 / 橙 ≥50 / 红 <50，与设计稿 `m-screens-4.jsx` 行卡胜率列一致。
  static Color winRateColor(double winRate, QzColorScheme c) {
    if (winRate >= 70) return c.statusOk;
    if (winRate >= 50) return c.statusWarn;
    return c.statusDanger;
  }

  /// 暴露给测试的纯函数：胜率展示为整数百分比，如 `85%`。
  static String formatWinRate(double winRate) => '${winRate.round()}%';

  /// 暴露给测试的纯函数（locale-neutral）：'just now' / 'Nm ago' / 'Nh ago' / 'Nd ago'。
  static String formatRelativeTime(DateTime ts, DateTime now) {
    final Duration d = now.difference(ts);
    if (d.inSeconds < 60) return 'just now';
    if (d.inMinutes < 60) return '${d.inMinutes}m ago';
    if (d.inHours < 24) return '${d.inHours}h ago';
    return '${d.inDays}d ago';
  }

  String _localizedRelativeTime(
    AppLocalizations l10n,
    DateTime ts,
    DateTime now,
  ) {
    final Duration d = now.difference(ts);
    if (d.inSeconds < 60) return l10n.whaleTimeJustNow;
    if (d.inMinutes < 60) {
      return '${d.inMinutes}${l10n.whaleTimeMinutesAgoSuffix}';
    }
    if (d.inHours < 24) return '${d.inHours}${l10n.whaleTimeHoursAgoSuffix}';
    return '${d.inDays}${l10n.whaleTimeDaysAgoSuffix}';
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final DateTime now = _now ?? DateTime.now();
    final DateTime tsForDisplay = displayTimestamp ?? event.timestamp;
    final String relTime = _localizedRelativeTime(l10n, tsForDisplay, now);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 700),
      margin: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        0,
        QzSpacing.lg,
        QzSpacing.sm,
      ),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: highlight ? c.accentSoft : c.bgElev,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.borderSoft),
        boxShadow: const <BoxShadow>[
          BoxShadow(
            color: Color(0x080F172A),
            offset: Offset(0, 1),
            blurRadius: 2,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _buildHeaderRow(c, relTime, l10n),
          const SizedBox(height: QzSpacing.sm),
          _buildPositionRow(c, l10n),
          const SizedBox(height: QzSpacing.sm),
          _buildMetricsRow(c, l10n),
        ],
      ),
    );
  }

  /// Row1：地址 + 商人标签 + fresh 圆点 + 相对时间。
  Widget _buildHeaderRow(
    QzColorScheme c,
    String relTime,
    AppLocalizations l10n,
  ) {
    final String addressText = event.address ?? event.fromLabel;
    return Row(
      children: <Widget>[
        Expanded(
          child: Row(
            children: <Widget>[
              Flexible(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: onOpen,
                  child: Container(
                    padding: const EdgeInsets.only(bottom: 1),
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: c.accent.withValues(alpha: 0.4),
                        ),
                      ),
                    ),
                    child: Text(
                      addressText,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.accent,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        fontFamily: QzFont.mono,
                        fontFamilyFallback: QzFont.monoFallback,
                        fontFeatures: const <FontFeature>[
                          FontFeature.tabularFigures(),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.xs),
              Icon(Icons.copy, size: 12, color: c.textMid),
              if (event.traderTag != null) ...<Widget>[
                const SizedBox(width: QzSpacing.sm),
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: c.accentSoft,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      event.traderTag!,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.accent,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
              if (event.isFresh) ...<Widget>[
                const SizedBox(width: QzSpacing.sm),
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: c.marketUp,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: QzSpacing.sm),
        SizedBox(
          width: 116,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: <Widget>[
              Flexible(
                child: Text(
                  relTime,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    color: c.textDim,
                    fontSize: 11,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.xs),
              Tooltip(
                message: l10n.whaleLeaderTrendTooltip,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: onStats,
                  child: Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: c.bgElev,
                      border: Border.all(color: c.borderSoft),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Icon(Icons.show_chart, size: 13, color: c.textMid),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Row2：币种 + mode + 多/空胶囊 + 杠杆。
  Widget _buildPositionRow(QzColorScheme c, AppLocalizations l10n) {
    final bool isLong = event.side == 'long';
    final bool isShort = event.side == 'short';
    final Color sideColor = isLong ? c.marketUp : c.marketDown;
    return Row(
      children: <Widget>[
        Container(
          height: 22,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          decoration: BoxDecoration(
            color: c.bgSoft,
            borderRadius: BorderRadius.circular(11),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: _symbolColor(event.symbol, c),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              const SizedBox(width: 5),
              Text(
                event.symbol,
                style: TextStyle(
                  color: c.text,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        if (event.mode != null) ...<Widget>[
          const SizedBox(width: QzSpacing.sm),
          Text(
            event.mode!,
            style: TextStyle(
              color: c.textMid,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
        const Spacer(),
        if (isLong || isShort)
          Container(
            height: 22,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: sideColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: sideColor.withValues(alpha: 0.2)),
            ),
            child: Text(
              isLong ? l10n.whaleRowLong : l10n.whaleRowShort,
              style: TextStyle(
                color: sideColor,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.4,
              ),
            ),
          ),
        const SizedBox(width: QzSpacing.sm),
        Text(
          event.leverage == null ? _dash : '${event.leverage}x',
          style: TextStyle(
            color: c.textDim,
            fontSize: 11,
            fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }

  /// Row3：持仓价值/数量 · 开盘价 · 胜率。
  Widget _buildMetricsRow(QzColorScheme c, AppLocalizations l10n) {
    final String valueText = event.positionValue == null
        ? _dash
        : formatAmountUsd(event.positionValue!);
    final String openText = event.openPrice == null
        ? _dash
        : formatPrice(event.openPrice!);
    return Container(
      margin: const EdgeInsets.only(top: 2),
      padding: const EdgeInsets.only(top: 10),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: c.borderSoft, style: BorderStyle.solid),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(
            flex: 13,
            child: _MetricCell(
              label: l10n.whaleRowPositionValue,
              value: valueText,
              valueColor: c.text,
              valueSize: 15,
              caption: event.quantity,
            ),
          ),
          Expanded(
            flex: 10,
            child: _MetricCell(
              label: l10n.whaleRowOpenPrice,
              value: openText,
              valueColor: c.text,
              valueSize: 13,
            ),
          ),
          Expanded(
            flex: 7,
            child: _MetricCell(
              label: l10n.whaleRowWinRate,
              value: formatWinRate(event.winRate),
              valueColor: winRateColor(event.winRate, c),
              valueSize: 14,
              alignEnd: true,
            ),
          ),
        ],
      ),
    );
  }

  Color _symbolColor(String symbol, QzColorScheme c) {
    if (symbol.startsWith('BTC')) return const Color(0xFFF7931A);
    if (symbol.startsWith('ETH')) return const Color(0xFF627EEA);
    if (symbol.startsWith('SOL')) return const Color(0xFF9945FF);
    return c.textMid;
  }
}

/// Row3 单元格：上方小标签 + 主值（可带次级 caption）。
class _MetricCell extends StatelessWidget {
  const _MetricCell({
    required this.label,
    required this.value,
    required this.valueColor,
    required this.valueSize,
    this.caption,
    this.alignEnd = false,
  });

  final String label;
  final String value;
  final Color valueColor;
  final double valueSize;
  final String? caption;
  final bool alignEnd;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final CrossAxisAlignment cross = alignEnd
        ? CrossAxisAlignment.end
        : CrossAxisAlignment.start;
    return Column(
      crossAxisAlignment: cross,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(
            color: c.textDim,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: valueColor,
            fontSize: valueSize,
            fontWeight: FontWeight.w700,
            fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
          ),
        ),
        if (caption != null) ...<Widget>[
          const SizedBox(height: 1),
          Text(
            caption!,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: c.textDim,
              fontSize: 10,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
        ],
      ],
    );
  }
}
