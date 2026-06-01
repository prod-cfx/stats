import 'package:flutter/material.dart';

import '../../../data/models/whale_leader_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 发现 tab 排序条（issue #1789）。胜率/账户总价值/已实现盈亏三档药丸。
///
/// 点击循环：非该 key → (key, desc)；(key, desc) → (key, asc)；
/// (key, asc) → null（恢复原序）。激活药丸高亮当前方向三角。
class WhaleSortBar extends StatelessWidget {
  const WhaleSortBar({
    required this.sort,
    required this.onChanged,
    super.key,
  });

  final WhaleLeaderSort? sort;
  final void Function(WhaleLeaderSort?) onChanged;

  void _handleTap(WhaleLeaderSortKey key) {
    if (sort == null || sort!.key != key) {
      onChanged(WhaleLeaderSort(key: key, dir: WhaleLeaderSortDir.desc));
    } else if (sort!.dir == WhaleLeaderSortDir.desc) {
      onChanged(WhaleLeaderSort(key: key, dir: WhaleLeaderSortDir.asc));
    } else {
      onChanged(null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<(WhaleLeaderSortKey, String)> opts =
        <(WhaleLeaderSortKey, String)>[
      (WhaleLeaderSortKey.winRate, l10n.whaleSortWinRate),
      (WhaleLeaderSortKey.aum, l10n.whaleSortAum),
      (WhaleLeaderSortKey.pnl, l10n.whaleSortPnl),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: QzSpacing.md,
      ),
      child: Row(
        children: <Widget>[
          Text(
            l10n.whaleSortByLabel,
            style: TextStyle(color: c.textMid, fontSize: 12),
          ),
          const SizedBox(width: QzSpacing.sm),
          for (final (WhaleLeaderSortKey, String) o in opts)
            Padding(
              padding: const EdgeInsets.only(right: QzSpacing.sm),
              child: _SortPill(
                label: o.$2,
                active: sort?.key == o.$1,
                dir: sort?.key == o.$1 ? sort!.dir : null,
                onTap: () => _handleTap(o.$1),
              ),
            ),
        ],
      ),
    );
  }
}

class _SortPill extends StatelessWidget {
  const _SortPill({
    required this.label,
    required this.active,
    required this.dir,
    required this.onTap,
  });

  final String label;
  final bool active;
  final WhaleLeaderSortDir? dir;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color fg = active ? c.accentOn : c.textMid;
    final Color upColor = active && dir == WhaleLeaderSortDir.asc
        ? fg
        : fg.withValues(alpha: 0.4);
    final Color downColor = active && dir == WhaleLeaderSortDir.desc
        ? fg
        : fg.withValues(alpha: 0.4);
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
        decoration: BoxDecoration(
          color: active ? c.accent : c.bgSoft,
          borderRadius: BorderRadius.circular(QzRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              label,
              style: TextStyle(
                color: fg,
                fontSize: 12,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
            const SizedBox(width: 4),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(Icons.arrow_drop_up, size: 12, color: upColor),
                Transform.translate(
                  offset: const Offset(0, -6),
                  child: Icon(Icons.arrow_drop_down, size: 12, color: downColor),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
