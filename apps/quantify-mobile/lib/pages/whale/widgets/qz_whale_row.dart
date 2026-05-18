import 'package:flutter/material.dart';

import '../../../data/models/whale_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 巨鲸事件单行展示。
///
/// 设计要点：
/// - 方向 icon：`in` 绿色 `arrow_downward` / `out` 红色 `arrow_upward`，
///   语义上"流入"=资金进场（看涨），"流出"=资金离场（看跌）。
/// - 高亮：新条目从顶部插入后，外层在 700ms 内将 `highlight=true` 切回 false；
///   行内用 [AnimatedContainer] 在 700ms 内淡出 `accentSoft` 背景。
/// - 相对时间显示由外部注入 `now` 计算，不读 fixture 真实墙钟，避免测试 flake。
class QzWhaleRow extends StatelessWidget {
  const QzWhaleRow({
    super.key,
    required this.event,
    this.highlight = false,
    DateTime? now,
  }) : _now = now;

  final WhaleEvent event;
  final bool highlight;
  final DateTime? _now;

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

  /// 暴露给测试的纯函数（locale-neutral）：返回 'just now' / 'Nm ago' / 'Nh ago' / 'Nd ago'。
  /// UI 展示请使用 [_localizedRelativeTime]。
  static String formatRelativeTime(DateTime ts, DateTime now) {
    final Duration d = now.difference(ts);
    if (d.inSeconds < 60) return 'just now';
    if (d.inMinutes < 60) return '${d.inMinutes}m ago';
    if (d.inHours < 24) return '${d.inHours}h ago';
    return '${d.inDays}d ago';
  }

  String _localizedRelativeTime(AppLocalizations l10n, DateTime ts, DateTime now) {
    final Duration d = now.difference(ts);
    if (d.inSeconds < 60) return l10n.whaleTimeJustNow;
    if (d.inMinutes < 60) return '${d.inMinutes}${l10n.whaleTimeMinutesAgoSuffix}';
    if (d.inHours < 24) return '${d.inHours}${l10n.whaleTimeHoursAgoSuffix}';
    return '${d.inDays}${l10n.whaleTimeDaysAgoSuffix}';
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool isIn = event.direction == 'in';
    final Color dirColor = isIn ? c.statusOk : c.statusDanger;
    final IconData dirIcon = isIn ? Icons.arrow_downward : Icons.arrow_upward;
    final DateTime now = _now ?? DateTime.now();
    final String relTime = _localizedRelativeTime(l10n, event.timestamp, now);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 700),
      color: highlight ? c.accentSoft : Colors.transparent,
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: QzSpacing.md,
      ),
      child: Row(
        children: <Widget>[
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: dirColor.withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            child: Icon(dirIcon, size: 18, color: dirColor),
          ),
          const SizedBox(width: QzSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Flexible(
                      child: Text(
                        event.symbol,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: c.text,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(width: QzSpacing.sm),
                    Text(
                      formatAmountUsd(event.amountUsd),
                      style: TextStyle(
                        color: dirColor,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  '${event.fromLabel} → ${event.toLabel}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: c.textMid, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Text(
            relTime,
            style: TextStyle(color: c.textDim, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
