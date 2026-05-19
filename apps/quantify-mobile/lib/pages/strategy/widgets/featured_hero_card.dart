import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/tokens.dart';
import 'sparkline_view.dart';

/// 「本周推荐」featured hero 卡（#1565）。
///
/// 紫色渐变背景 + 半透明 sparkline 装饰 + 3 项核心指标（CAGR / Sharpe / 回撤）。
/// 顶层包 `InkWell` 让整卡可点；颜色不读 theme token——hero 是品牌渐变，
/// 在 3 套主题下保持视觉锚点一致。
class FeaturedHeroCard extends StatelessWidget {
  const FeaturedHeroCard({
    super.key,
    required this.item,
    required this.onTap,
  });

  final StrategyMarketItem item;
  final VoidCallback onTap;

  String _fmtPct(double v, {bool sign = true}) =>
      '${sign && v > 0 ? '+' : ''}${v.toStringAsFixed(1)}%';

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final StrategyCard card = item.card;
    final StrategyMarketStats stats = item.stats;

    return Padding(
      padding: const EdgeInsets.only(bottom: QzSpacing.md),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(QzRadii.card),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(QzRadii.card),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: <Color>[
                  Color(0xFF1A1530),
                  Color(0xFF2B1E5A),
                ],
              ),
            ),
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.md,
              QzSpacing.lg,
              QzSpacing.md,
            ),
            child: Stack(
              children: <Widget>[
                // 装饰 sparkline 半透明铺底
                Positioned.fill(
                  child: Opacity(
                    opacity: 0.35,
                    child: SparklineView(
                      data: item.sparkline,
                      height: 80,
                      strokeWidth: 1.2,
                    ),
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: QzSpacing.sm,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            borderRadius:
                                BorderRadius.circular(QzRadii.input),
                          ),
                          child: Text(
                            l10n.strategyHomeFeaturedBadge,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.6,
                            ),
                          ),
                        ),
                        const SizedBox(width: QzSpacing.sm),
                        Text(
                          '· ${l10n.strategyHomeFeaturedSubtitle}',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.7),
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: QzSpacing.sm),
                    Text(
                      card.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: QzSpacing.xxs),
                    Text(
                      card.description,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.75),
                        fontSize: 11.5,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: QzSpacing.sm),
                    Row(
                      children: <Widget>[
                        _HeroStat(
                          label: l10n.strategyHomeStatCagr,
                          value: _fmtPct(stats.cagr),
                          hot: true,
                        ),
                        const SizedBox(width: QzSpacing.lg),
                        _HeroStat(
                          label: l10n.strategyHomeStatSharpe,
                          value: stats.sharpe.toStringAsFixed(2),
                        ),
                        const SizedBox(width: QzSpacing.lg),
                        _HeroStat(
                          label: l10n.strategyHomeStatDrawdown,
                          value: _fmtPct(stats.maxDrawdown, sign: false),
                        ),
                        const Spacer(),
                        Text(
                          l10n.strategyHomeFeaturedView,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({
    required this.label,
    required this.value,
    this.hot = false,
  });

  final String label;
  final String value;
  final bool hot;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.6),
            fontSize: 9,
            letterSpacing: 0.4,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            color: hot ? const Color(0xFF7EFFB0) : Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w700,
            fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}
