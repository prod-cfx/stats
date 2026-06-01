import 'package:flutter/material.dart';

import '../../../data/models/live_strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import 'live_sparkline.dart';
import 'live_status_style.dart';

/// 实盘策略列表卡（#1752 / #1975）。
///
/// 对齐设计稿 `LsStratCard`（jsx:985-1067）：交易所 glyph + 名称 + 状态 badge
/// + 元信息行 + 今日/累计盈亏 + 微型权益曲线（perf 行右侧）+ 底部 footer
/// （分割线 + 浅灰底，左侧 meta `ID · 运行N · 笔数 · 胜率%`，右侧 暂停/开启 +
/// 更多按钮）。
///
/// 点击主体区进入详情（[onTap]）；footer 的暂停/开启与菜单按钮分别上抛
/// [onToggle] / [onOpenMenu]，由父级 `live_strategies_page.dart` 接通写操作。
class LiveStrategyCard extends StatelessWidget {
  const LiveStrategyCard({
    super.key,
    required this.strategy,
    this.onTap,
    this.onToggle,
    this.onOpenMenu,
  });

  final LiveStrategy strategy;
  final VoidCallback? onTap;
  final VoidCallback? onToggle;
  final VoidCallback? onOpenMenu;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final BorderRadius radius = BorderRadius.circular(QzRadii.card);

    return Padding(
      padding: const EdgeInsets.only(bottom: QzSpacing.md),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: c.bgElev,
          border: Border.all(color: c.border),
          borderRadius: radius,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _ClickableBody(strategy: strategy, onTap: onTap),
            _Footer(
              strategy: strategy,
              onToggle: onToggle,
              onOpenMenu: onOpenMenu,
            ),
          ],
        ),
      ),
    );
  }
}

/// 卡片可点击主体：头部 + perf 行（含 sparkline）。
class _ClickableBody extends StatelessWidget {
  const _ClickableBody({required this.strategy, this.onTap});
  final LiveStrategy strategy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final LiveStatusStyle st = liveStatusStyle(strategy.status, c, l10n);
    final bool totalUp = strategy.totalPnl >= 0;
    final bool todayUp = strategy.todayPnl >= 0;

    final Widget body = Padding(
      padding: const EdgeInsets.all(QzSpacing.lg),
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
            crossAxisAlignment: CrossAxisAlignment.center,
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
              LiveSparkline(points: strategy.spark, up: totalUp),
            ],
          ),
        ],
      ),
    );

    if (onTap == null) return body;
    return Material(
      color: Colors.transparent,
      child: InkWell(onTap: onTap, child: body),
    );
  }

  static String _money(double v) {
    final String sign = v >= 0 ? '+' : '-';
    return '$sign\$${v.abs().toStringAsFixed(2)}';
  }
}

/// 底部 footer：分割线 + 浅灰底，左 meta，右 暂停/开启 + 更多。
class _Footer extends StatelessWidget {
  const _Footer({
    required this.strategy,
    this.onToggle,
    this.onOpenMenu,
  });
  final LiveStrategy strategy;
  final VoidCallback? onToggle;
  final VoidCallback? onOpenMenu;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);

    final bool stopped = strategy.status == LiveStrategyStatus.stopped;
    final bool canStart = strategy.status == LiveStrategyStatus.paused ||
        strategy.status == LiveStrategyStatus.warning;
    final bool ok = stopped || canStart;
    final IconData toggleIcon =
        ok ? Icons.play_arrow_rounded : Icons.pause_rounded;
    final String toggleTooltip = stopped
        ? l10n.liveActionResume
        : (canStart ? l10n.liveActionStart : l10n.liveActionPause);

    final String winRate = strategy.winRate == strategy.winRate.roundToDouble()
        ? strategy.winRate.toStringAsFixed(0)
        : strategy.winRate.toStringAsFixed(1);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: 10,
      ),
      decoration: BoxDecoration(
        color: c.bgSoft,
        border: Border(top: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              '${strategy.id} · '
              '${l10n.liveCardRunFor(strategy.runFor)} · '
              '${l10n.liveCardTrades(strategy.trades)} · '
              '${l10n.liveCardWinRate(winRate)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: c.textDim,
                fontSize: 10,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          _ActionBtn(
            key: const Key('live-card-toggle'),
            icon: toggleIcon,
            color: ok ? c.statusOk : c.textMid,
            tooltip: toggleTooltip,
            onTap: onToggle,
          ),
          const SizedBox(width: QzSpacing.xs),
          _ActionBtn(
            key: const Key('live-card-menu'),
            icon: Icons.more_horiz_rounded,
            color: c.textMid,
            tooltip: l10n.liveCardMenuTooltip,
            onTap: onOpenMenu,
          ),
        ],
      ),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({
    super.key,
    required this.icon,
    required this.color,
    required this.tooltip,
    this.onTap,
  });
  final IconData icon;
  final Color color;
  final String tooltip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: c.bgElev,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Tooltip(
          message: tooltip,
          child: SizedBox(
            width: 32,
            height: 32,
            child: Icon(icon, size: 17, color: color),
          ),
        ),
      ),
    );
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
