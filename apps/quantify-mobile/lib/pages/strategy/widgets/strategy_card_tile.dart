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

/// 策略广场列表卡片（#1595 对齐设计稿 `StratCard`）。
///
/// 结构（自上而下）：
/// 1. 头像(40) + 名 + status badge + 收藏 star
///    类型 chip · 币对 · 周期
/// 2. 收益摘要块：近 {period} + CAGR + sparkline（soft 背景）
/// 3. 4 格 mini stats：Sharpe / 回撤 / 胜率 / 使用（居中）
/// 4. 作者头像(18) + 作者名 + 蓝 V + 「载入对话」紫色渐变实心按钮
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

  /// 「载入对话」按钮回调（#1559）。不为 null 时渲染紫色渐变实心按钮；
  /// 点击不冒泡 QzCard 的 onTap，避免误触详情。
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

  String _categoryLabel(BuildContext context, StrategyCategory category) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return switch (category) {
      // 卡片层级不会用到 all，仅为枚举完备性。
      StrategyCategory.all => '',
      StrategyCategory.trend => l10n.strategyCategoryTrend,
      StrategyCategory.grid => l10n.strategyCategoryGrid,
      StrategyCategory.arbitrage => l10n.strategyCategoryArbitrage,
      StrategyCategory.reversal => l10n.strategyCategoryReversal,
      StrategyCategory.hedge => l10n.strategyCategoryHedge,
      StrategyCategory.highFreq => l10n.strategyCategoryHighFreq,
    };
  }

  QzChipTone _categoryTone(StrategyCategory category) {
    return switch (category) {
      StrategyCategory.trend => QzChipTone.accent,
      StrategyCategory.grid => QzChipTone.info,
      StrategyCategory.arbitrage => QzChipTone.ok,
      StrategyCategory.reversal => QzChipTone.warn,
      StrategyCategory.hedge => QzChipTone.info,
      StrategyCategory.highFreq => QzChipTone.danger,
      StrategyCategory.all => QzChipTone.neutral,
    };
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
            // 行 1：头像(40) + 名/状态 + 类型/币对/周期 + star
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                QzAvatar(label: initial, size: 40),
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
                      const SizedBox(height: 4),
                      // 类型 chip + 币对 + 周期
                      Wrap(
                        spacing: QzSpacing.xs,
                        runSpacing: 2,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: <Widget>[
                          if (_categoryLabel(context, card.category).isNotEmpty)
                            QzChip(
                              label: _categoryLabel(context, card.category),
                              tone: _categoryTone(card.category),
                            ),
                          if (card.pair.isNotEmpty)
                            Text(
                              card.pair,
                              style: TextStyle(
                                color: c.textDim,
                                fontSize: 10.5,
                                fontFeatures: const <FontFeature>[
                                  FontFeature.tabularFigures(),
                                ],
                              ),
                            ),
                          if (card.period.isNotEmpty)
                            Text(
                              '· ${card.period}',
                              style: TextStyle(
                                color: c.textDim,
                                fontSize: 10.5,
                              ),
                            ),
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
            // 行 2：收益摘要块——近 {period} + CAGR + sparkline
            _ReturnSummaryBlock(
              key: Key('strategy-card-summary-${card.id}'),
              // 设计稿原文 `近 {period}`；period 缺省时仅显示 `近期`。
              // 暂不引入 l10n 模板字符串，period 自身已是与语言无关的标签
              // （如 `7D` / `30D`）。
              periodLabel:
                  card.period.isEmpty ? '近期' : '近 ${card.period}',
              pnlPercent: card.pnlPercent,
              up: up,
              sparkline: item.sparkline,
            ),
            const SizedBox(height: QzSpacing.md),
            // 行 3：4 格指标（Sharpe / 回撤 / 胜率 / 使用），居中
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
            // 行 4：作者头像/名/认证 + 载入对话紫色渐变按钮
            Row(
              children: <Widget>[
                Expanded(
                  child: Row(
                    children: <Widget>[
                      _AuthorAvatar(initial: initial),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          card.author,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: c.textMid,
                            fontSize: 11,
                            height: 1.2,
                          ),
                        ),
                      ),
                      if (card.verified) ...<Widget>[
                        const SizedBox(width: 4),
                        _VerifiedMark(
                          key: Key('strategy-verified-${card.id}'),
                        ),
                      ],
                    ],
                  ),
                ),
                if (onLoadConversation != null) ...<Widget>[
                  const SizedBox(width: QzSpacing.sm),
                  _LoadConversationButton(
                    key: Key('strategy-card-load-chat-${card.id}'),
                    onPressed: onLoadConversation!,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// 收益摘要块（#1595）：soft 背景 + 「近 {period}」+ CAGR + sparkline。
class _ReturnSummaryBlock extends StatelessWidget {
  const _ReturnSummaryBlock({
    super.key,
    required this.periodLabel,
    required this.pnlPercent,
    required this.up,
    required this.sparkline,
  });

  final String periodLabel;
  final double pnlPercent;
  final bool up;
  final List<double> sparkline;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color pnlColor = up ? c.marketUp : c.marketDown;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 10,
        vertical: 8,
      ),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  periodLabel,
                  style: TextStyle(
                    color: c.textDim,
                    fontSize: 10,
                    letterSpacing: 0.4,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: <Widget>[
                    Text(
                      '${up ? '+' : ''}${pnlPercent.toStringAsFixed(1)}%',
                      style: TextStyle(
                        color: pnlColor,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        fontFeatures: const <FontFeature>[
                          FontFeature.tabularFigures(),
                        ],
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'CAGR',
                      style: TextStyle(
                        color: c.textDim,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          SizedBox(
            width: 120,
            height: 36,
            child: SparklineView(data: sparkline, height: 36, strokeWidth: 1.6),
          ),
        ],
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

/// 底部作者头像（18×18 圆形，首字符）（#1595）。
class _AuthorAvatar extends StatelessWidget {
  const _AuthorAvatar({required this.initial});
  final String initial;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      width: 18,
      height: 18,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: c.accent,
      ),
      alignment: Alignment.center,
      child: Text(
        initial,
        style: TextStyle(
          color: c.accentOn,
          fontSize: 9,
          fontWeight: FontWeight.w700,
          height: 1.0,
        ),
      ),
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
      crossAxisAlignment: CrossAxisAlignment.center,
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

/// 「载入对话」紫色渐变实心按钮（#1595 对齐设计稿）。
///
/// 设计稿：`background: violetGrad`、圆角 10、bot icon + 文字、白色文字、
/// boxShadow rgba(124,92,255,0.32)。`accentGrad` 跟随当前 accent 主题切换。
class _LoadConversationButton extends StatelessWidget {
  const _LoadConversationButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(10),
        child: Ink(
          decoration: BoxDecoration(
            gradient: c.accentGrad,
            borderRadius: BorderRadius.circular(10),
            boxShadow: <BoxShadow>[c.accentShadow],
          ),
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(
                Icons.smart_toy_outlined,
                size: 14,
                color: c.accentOn,
              ),
              const SizedBox(width: 5),
              Text(
                l10n.strategyCardLoadConversation,
                style: TextStyle(
                  color: c.accentOn,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
