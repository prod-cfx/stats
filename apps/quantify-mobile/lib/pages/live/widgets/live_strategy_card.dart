import 'package:flutter/material.dart';

import '../../../domain/models/live_strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import 'live_sparkline.dart';
import 'live_status_style.dart';

/// 实盘策略列表卡（#1752 / #1975）。
///
/// 对齐设计稿 `LsStratCard`（jsx:985-1067）：交易所 glyph + 名称 + 状态 badge
/// + 元信息行 + 总收益/交易次数 + 微型权益曲线（perf 行右侧）+ 底部 footer
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
      padding: const EdgeInsets.only(bottom: 10),
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
    final bool totalUp = strategy.totalPct >= 0;

    final Widget body = Padding(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _ExchangeGlyph(strategy: strategy),
                const SizedBox(width: 10),
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
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const SizedBox(width: QzSpacing.xs),
                          _StatusBadge(style: st, status: strategy.status),
                        ],
                      ),
                      const SizedBox(height: 3),
                      _MetaLine(strategy: strategy),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: <Widget>[
                Expanded(
                  child: _MetricCell(
                    label: _shortLabel(context, zh: '总收益', en: 'Total Return'),
                    value: _formatSignedPct(strategy.totalPct),
                    detail: _formatSignedUsd(strategy.totalPnl, decimals: 2),
                    color: strategy.totalPct == 0
                        ? c.textMid
                        : (totalUp ? c.marketUp : c.marketDown),
                  ),
                ),
                const SizedBox(width: QzSpacing.md),
                Expanded(
                  child: _MetricCell(
                    label: _shortLabel(context, zh: '交易次数', en: 'Trades'),
                    value: strategy.trades.toString(),
                    color: c.text,
                  ),
                ),
                const SizedBox(width: QzSpacing.md),
                LiveSparkline(points: strategy.spark, up: totalUp),
              ],
            ),
          ),
          if (strategy.statusNote != null)
            _StatusNote(style: st, note: strategy.statusNote!),
        ],
      ),
    );

    if (onTap == null) return body;
    return Material(
      color: Colors.transparent,
      child: InkWell(onTap: onTap, child: body),
    );
  }
}

String _formatSignedPct(double value) {
  return '${value >= 0 ? '+' : ''}${value.toStringAsFixed(2)}%';
}

String _formatSignedUsd(double value, {required int decimals}) {
  return '${value >= 0 ? '+' : ''}\$${value.abs().toStringAsFixed(decimals)}';
}

String _shortLabel(
  BuildContext context, {
  required String zh,
  required String en,
}) {
  return Localizations.localeOf(context).languageCode == 'zh' ? zh : en;
}

class _MetaLine extends StatelessWidget {
  const _MetaLine({required this.strategy});
  final LiveStrategy strategy;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final List<String> parts = <String>[
      strategy.pair,
      strategy.timeframe,
      strategy.market,
      strategy.exchange,
    ].where((String part) => part.trim().isNotEmpty).toList(growable: false);
    if (parts.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 6,
      runSpacing: 2,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: <Widget>[
        for (int i = 0; i < parts.length; i++) ...<Widget>[
          if (i > 0)
            Text(
              '·',
              style: TextStyle(
                color: c.textFaint,
                fontSize: 11,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          Text(
            parts[i],
            style: TextStyle(
              color: c.textDim,
              fontSize: 11,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ],
      ],
    );
  }
}

class _StatusNote extends StatelessWidget {
  const _StatusNote({required this.style, required this.note});
  final LiveStatusStyle style;
  final String note;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: style.bg,
        border: Border(top: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.shield_outlined, size: 11, color: style.fg),
          const SizedBox(width: QzSpacing.xs),
          Expanded(
            child: Text(
              note,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: style.fg,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 底部 footer：分割线 + 浅灰底，左 meta，右 暂停/开启 + 更多。
class _Footer extends StatelessWidget {
  const _Footer({required this.strategy, this.onToggle, this.onOpenMenu});
  final LiveStrategy strategy;
  final VoidCallback? onToggle;
  final VoidCallback? onOpenMenu;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);

    final bool stopped = strategy.status == LiveStrategyStatus.stopped;
    final bool isHistory = strategy.isHistory;
    final bool canStart =
        strategy.status == LiveStrategyStatus.paused ||
        strategy.status == LiveStrategyStatus.warning;
    final bool ok = stopped || canStart;
    final IconData toggleIcon = ok
        ? Icons.play_arrow_rounded
        : Icons.pause_rounded;
    final String toggleTooltip = stopped
        ? l10n.liveActionResume
        : (canStart ? l10n.liveActionStart : l10n.liveActionPause);

    final List<String> metaParts = <String>[
      strategy.id,
      if (strategy.runFor.trim().isNotEmpty)
        l10n.liveCardRunFor(strategy.runFor),
      if (strategy.trades > 0) l10n.liveCardTrades(strategy.trades),
      if (strategy.winRate > 0) l10n.liveCardWinRate(_formatWinRate(strategy)),
    ].where((String part) => part.trim().isNotEmpty).toList(growable: false);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: c.bgSoft,
        border: Border(top: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          Expanded(child: _FooterMeta(parts: metaParts)),
          const SizedBox(width: QzSpacing.sm),
          if (!isHistory) ...<Widget>[
            _ActionBtn(
              key: const Key('live-card-toggle'),
              icon: toggleIcon,
              color: ok ? c.statusOk : c.textMid,
              tooltip: toggleTooltip,
              onTap: onToggle,
            ),
            const SizedBox(width: QzSpacing.xs),
          ],
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

String _formatWinRate(LiveStrategy strategy) {
  return strategy.winRate == strategy.winRate.roundToDouble()
      ? strategy.winRate.toStringAsFixed(0)
      : strategy.winRate.toStringAsFixed(1);
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
      borderRadius: BorderRadius.circular(7),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border.all(color: c.border),
          borderRadius: BorderRadius.circular(7),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(7),
          child: Tooltip(
            message: tooltip,
            child: SizedBox(
              width: 30,
              height: 30,
              child: Icon(icon, size: 16, color: color),
            ),
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
    final Color bg = switch (strategy.exchange) {
      'Binance' => const Color(0xFF181A20),
      'OKX' => Colors.black,
      _ => const Color(0xFFF8F9FC),
    };
    final Color fg = switch (strategy.exchange) {
      'Binance' => const Color(0xFFF3BA2F),
      'OKX' => Colors.white,
      _ => const Color(0xFF7C5CFF),
    };
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(9),
      ),
      alignment: Alignment.center,
      child: Text(
        strategy.exchangeGlyph,
        style: TextStyle(color: fg, fontSize: 16, fontWeight: FontWeight.w700),
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
      height: 20,
      padding: const EdgeInsets.symmetric(horizontal: 7),
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
            decoration: BoxDecoration(
              color: style.dot,
              shape: BoxShape.circle,
              boxShadow: status == LiveStrategyStatus.running
                  ? <BoxShadow>[
                      BoxShadow(
                        color: style.dot.withValues(alpha: 0.2),
                        spreadRadius: 3,
                      ),
                    ]
                  : null,
            ),
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

class _MetricCell extends StatelessWidget {
  const _MetricCell({
    required this.label,
    required this.value,
    required this.color,
    this.detail,
  });
  final String label;
  final String value;
  final Color color;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: TextStyle(color: c.textDim, fontSize: 10)),
        const SizedBox(height: 3),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontSize: 16,
            fontWeight: FontWeight.w700,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
        if (detail != null) ...<Widget>[
          const SizedBox(height: 2),
          Text(
            detail!,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: c.textDim,
              fontSize: 10,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ],
      ],
    );
  }
}

class _FooterMeta extends StatelessWidget {
  const _FooterMeta({required this.parts});
  final List<String> parts;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Wrap(
      spacing: 6,
      runSpacing: 2,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: <Widget>[
        for (int i = 0; i < parts.length; i++) ...<Widget>[
          if (i > 0)
            Text(
              '·',
              style: TextStyle(
                color: c.textFaint,
                fontSize: 10,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          Text(
            parts[i],
            style: TextStyle(
              color: c.textDim,
              fontSize: 10,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ],
      ],
    );
  }
}
