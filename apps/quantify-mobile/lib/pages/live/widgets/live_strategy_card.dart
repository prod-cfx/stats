import 'package:flutter/material.dart';

import '../../../data/models/live_strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_card.dart';
import 'live_status_style.dart';

/// 实盘策略列表卡（#1752）。
///
/// 对齐设计稿 `LsStratCard`：交易所 glyph + 名称 + 状态 badge + 元信息行
/// + 今日/累计盈亏。点击整卡进入详情。暂停/菜单等写操作入口本迭代不接通，
/// 由父级以禁用态渲染（卡内不放操作按钮，保持单一职责）。
class LiveStrategyCard extends StatelessWidget {
  const LiveStrategyCard({super.key, required this.strategy, this.onTap});

  final LiveStrategy strategy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final LiveStatusStyle st = liveStatusStyle(strategy.status, c, l10n);
    final bool totalUp = strategy.totalPnl >= 0;
    final bool todayUp = strategy.todayPnl >= 0;

    return Padding(
      padding: const EdgeInsets.only(bottom: QzSpacing.md),
      child: QzCard(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _ExchangeGlyph(strategy: strategy),
                const SizedBox(width: QzSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: Text(
                              strategy.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: c.text,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: QzSpacing.sm),
                          _StatusBadge(style: st, status: strategy.status),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${strategy.pair} · ${strategy.timeframe} · '
                        '${strategy.market} · ${strategy.runFor}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: c.textDim,
                          fontSize: 11,
                          fontFamily: QzFont.mono,
                          fontFamilyFallback: QzFont.monoFallback,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: QzSpacing.md),
            Row(
              children: <Widget>[
                Expanded(
                  child: _PnlCell(
                    label: l10n.liveListTodayPnl,
                    value: _money(strategy.todayPnl),
                    pct: strategy.todayPct,
                    color: strategy.todayPnl == 0
                        ? c.text
                        : (todayUp ? c.marketUp : c.marketDown),
                  ),
                ),
                Expanded(
                  child: _PnlCell(
                    label: l10n.liveListTotalPnl,
                    value: _money(strategy.totalPnl),
                    pct: strategy.totalPct,
                    color: totalUp ? c.marketUp : c.marketDown,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static String _money(double v) {
    final String sign = v >= 0 ? '+' : '-';
    return '$sign\$${v.abs().toStringAsFixed(2)}';
  }
}

class _ExchangeGlyph extends StatelessWidget {
  const _ExchangeGlyph({required this.strategy});
  final LiveStrategy strategy;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(11),
      ),
      alignment: Alignment.center,
      child: Text(
        strategy.exchangeGlyph,
        style: TextStyle(
          color: c.accent,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.style, required this.status});
  final LiveStatusStyle style;
  final LiveStrategyStatus status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: style.bg,
        borderRadius: BorderRadius.circular(5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: style.dot, shape: BoxShape.circle),
          ),
          const SizedBox(width: 4),
          Text(
            style.label,
            style: TextStyle(
              color: style.fg,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _PnlCell extends StatelessWidget {
  const _PnlCell({
    required this.label,
    required this.value,
    required this.pct,
    required this.color,
  });
  final String label;
  final String value;
  final double pct;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final String pctStr = '${pct >= 0 ? '+' : ''}${pct.toStringAsFixed(2)}%';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: TextStyle(color: c.textDim, fontSize: 11)),
        const SizedBox(height: 3),
        Text(
          '$value · $pctStr',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontSize: 13,
            fontWeight: FontWeight.w700,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}
