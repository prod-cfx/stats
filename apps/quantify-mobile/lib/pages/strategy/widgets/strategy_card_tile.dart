import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_avatar.dart';
import '../../../widgets/qz_card.dart';
import '../../../widgets/qz_chip.dart';
import 'sparkline_view.dart';

/// 策略广场列表卡片。
class StrategyCardTile extends StatelessWidget {
  const StrategyCardTile({
    super.key,
    required this.item,
    required this.onTap,
  });

  final StrategyMarketItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final StrategyCard card = item.card;
    final bool up = card.pnlPercent >= 0;
    final String initial =
        card.author.isEmpty ? '?' : card.author.characters.first;

    return Padding(
      padding: const EdgeInsets.only(bottom: QzSpacing.md),
      child: QzCard(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            // 行 1：头像 + 名 + 作者
            Row(
              children: <Widget>[
                QzAvatar(label: initial, size: 32),
                const SizedBox(width: QzSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        card.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: c.text,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        card.author,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: c.textDim,
                          fontSize: 11,
                          height: 1.2,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: QzSpacing.md),
            // 行 2：sparkline + pnl 胶囊
            Row(
              children: <Widget>[
                Expanded(child: SparklineView(data: item.sparkline)),
                const SizedBox(width: QzSpacing.sm),
                _PnlPill(percent: card.pnlPercent, up: up),
              ],
            ),
            const SizedBox(height: QzSpacing.md),
            // 行 3：订阅数 + tags
            Row(
              children: <Widget>[
                Icon(Icons.people_outline, size: 14, color: c.textDim),
                const SizedBox(width: 4),
                Text(
                  '${card.subscribers}',
                  style: TextStyle(color: c.textDim, fontSize: 11),
                ),
                const SizedBox(width: QzSpacing.md),
                Expanded(
                  child: Wrap(
                    spacing: QzSpacing.xs,
                    runSpacing: QzSpacing.xs,
                    children: <Widget>[
                      for (final String tag in card.tags.take(3))
                        QzChip(label: tag, tone: QzChipTone.neutral),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PnlPill extends StatelessWidget {
  const _PnlPill({required this.percent, required this.up});

  final double percent;
  final bool up;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color base = up ? c.statusOk : c.statusDanger;
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: QzSpacing.sm, vertical: 4),
      decoration: BoxDecoration(
        color: base.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
      child: Text(
        '${up ? '+' : ''}${percent.toStringAsFixed(1)}%',
        style: TextStyle(
          color: base,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          height: 1.0,
        ),
      ),
    );
  }
}
