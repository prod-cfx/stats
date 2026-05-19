import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_avatar.dart';
import '../../../widgets/qz_card.dart';
import '../../../widgets/qz_chip.dart';
import 'sparkline_view.dart';
import 'strategy_status_badge_view.dart';

/// 策略广场列表卡片。
class StrategyCardTile extends StatelessWidget {
  const StrategyCardTile({
    super.key,
    required this.item,
    required this.onTap,
    this.onLoadConversation,
    this.starred = false,
    this.onToggleStar,
  });

  final StrategyMarketItem item;
  final VoidCallback onTap;

  /// 「载入对话」按钮回调（#1559）。
  ///
  /// 不为 null 时在右下角渲染 ghost 风格按钮；点击不冒泡 QzCard 的 onTap，
  /// 避免把卡片当作整体点击触发跳转详情。
  final VoidCallback? onLoadConversation;

  /// 是否已星标（#1565）。
  final bool starred;

  /// 星标切换回调（#1565）。null 时不渲染按钮（兼容历史）。
  final VoidCallback? onToggleStar;

  String _fmtUsers(int users) {
    if (users >= 1000) {
      return '${(users / 1000).toStringAsFixed(1)}k';
    }
    return '$users';
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final StrategyCard card = item.card;
    final StrategyMarketStats stats = item.stats;
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
            // 行 1：头像 + 名 + 作者 + status badge + star
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                QzAvatar(label: initial, size: 32),
                const SizedBox(width: QzSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Flexible(
                            child: Text(
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
                          ),
                          if (card.status != null) ...<Widget>[
                            const SizedBox(width: QzSpacing.xs),
                            StrategyStatusBadgeView(badge: card.status!),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: <Widget>[
                          Flexible(
                            child: Text(
                              card.author,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: c.textDim,
                                fontSize: 11,
                                height: 1.2,
                              ),
                            ),
                          ),
                          if (card.verified) ...<Widget>[
                            const SizedBox(width: 4),
                            _VerifiedMark(key: Key('strategy-verified-${card.id}')),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                if (onToggleStar != null)
                  IconButton(
                    key: Key('strategy-star-${card.id}'),
                    onPressed: onToggleStar,
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: 32,
                      minHeight: 32,
                    ),
                    icon: Icon(
                      starred ? Icons.star_rounded : Icons.star_outline_rounded,
                      size: 22,
                      color: starred
                          ? const Color(0xFFF59E0B)
                          : c.textDim,
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
            // 行 3：4 格指标（Sharpe / 回撤 / 胜率 / 使用）
            Row(
              children: <Widget>[
                Expanded(
                  child: _MiniStat(
                    label: l10n.strategyCardStatSharpe,
                    value: stats.sharpe.toStringAsFixed(2),
                  ),
                ),
                Expanded(
                  child: _MiniStat(
                    label: l10n.strategyCardStatDrawdown,
                    value: '${stats.maxDrawdown.toStringAsFixed(1)}%',
                    tone: _MiniStatTone.down,
                  ),
                ),
                Expanded(
                  child: _MiniStat(
                    label: l10n.strategyCardStatWinRate,
                    value: '${(stats.winRate * 100).toStringAsFixed(0)}%',
                  ),
                ),
                Expanded(
                  child: _MiniStat(
                    label: l10n.strategyCardStatUsers,
                    value: _fmtUsers(stats.users),
                  ),
                ),
              ],
            ),
            const SizedBox(height: QzSpacing.md),
            // 行 4：订阅数 + tags
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
            if (onLoadConversation != null) ...<Widget>[
              const SizedBox(height: QzSpacing.sm),
              Align(
                alignment: Alignment.centerRight,
                child: _LoadConversationButton(
                  key: Key('strategy-card-load-chat-${card.id}'),
                  onPressed: onLoadConversation!,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// 蓝 V 认证标（#1565）。
class _VerifiedMark extends StatelessWidget {
  const _VerifiedMark({super.key});

  @override
  Widget build(BuildContext context) {
    return const Icon(
      Icons.verified,
      size: 12,
      color: Color(0xFF3B82F6),
    );
  }
}

enum _MiniStatTone { neutral, up, down }

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.label,
    required this.value,
    this.tone = _MiniStatTone.neutral,
  });

  final String label;
  final String value;
  final _MiniStatTone tone;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color color = switch (tone) {
      _MiniStatTone.up => c.marketUp,
      _MiniStatTone.down => c.marketDown,
      _MiniStatTone.neutral => c.text,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(
            color: c.textDim,
            fontSize: 9,
            letterSpacing: 0.3,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

/// 「载入对话」ghost 按钮（图标 + 文字）。
///
/// 单独抽出来是为了独立测试 + 避免把 hover/splash 样式渗到 QzCard 自身。
class _LoadConversationButton extends StatelessWidget {
  const _LoadConversationButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(QzRadii.pill),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.sm,
          vertical: 6,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(Icons.chat_bubble_outline, size: 14, color: c.accent),
            const SizedBox(width: 4),
            Text(
              l10n.strategyCardLoadConversation,
              style: TextStyle(
                color: c.accent,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
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
