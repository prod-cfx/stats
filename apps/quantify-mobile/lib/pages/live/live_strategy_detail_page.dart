import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/live_strategy_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_chip.dart';
import '../../widgets/qz_segmented_tabs.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_top_bar.dart';
import 'widgets/live_equity_curve.dart';
import 'widgets/live_status_style.dart';

/// 实盘策略详情页（#1752，`/me/live/:id`）。
///
/// 对齐设计稿 `ScreenLiveStratDetail`：hero（交易所 glyph + 状态 + 累计盈亏
/// + 权益曲线）→ 4 tab（概览/持仓/交易记录/参数）→ 底部 sticky 主操作。
/// 开启/暂停/恢复/删除本迭代不接通，sticky 操作渲染为禁用 + tap 占位提示。
class LiveStrategyDetailPage extends ConsumerStatefulWidget {
  const LiveStrategyDetailPage({super.key, required this.id});
  final String id;

  @override
  ConsumerState<LiveStrategyDetailPage> createState() =>
      _LiveStrategyDetailPageState();
}

class _LiveStrategyDetailPageState
    extends ConsumerState<LiveStrategyDetailPage> {
  late String _tab;

  @override
  void initState() {
    super.initState();
    _tab = 'overview';
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AsyncValue<LiveStrategy> strategy =
        ref.watch(liveStrategyDetailProvider(widget.id));

    return Scaffold(
      backgroundColor: c.bg,
      body: strategy.when(
        loading: () => const Center(child: QzSpinner()),
        error: (Object e, StackTrace _) => Scaffold(
          appBar: QzTopBar(
            title: l10n.liveDetailTitle,
            onBack: () => context.pop(),
          ),
          body: Center(
            child: Text(
              l10n.liveLoadError,
              style: TextStyle(color: c.statusDanger),
            ),
          ),
        ),
        data: (LiveStrategy s) => _build(context, l10n, c, s),
      ),
    );
  }

  Widget _build(
    BuildContext context,
    AppLocalizations l10n,
    QzColorScheme c,
    LiveStrategy s,
  ) {
    return Column(
      children: <Widget>[
        QzTopBar(
          title: l10n.liveDetailTitle,
          subtitle: s.name,
          onBack: () => context.pop(),
        ),
        Expanded(
          child: Stack(
            children: <Widget>[
              ListView(
                padding: const EdgeInsets.fromLTRB(
                  QzSpacing.lg,
                  QzSpacing.md,
                  QzSpacing.lg,
                  100,
                ),
                children: <Widget>[
                  _Hero(strategy: s),
                  const SizedBox(height: QzSpacing.md),
                  QzSegmentedTabs(
                    options: <String>[
                      l10n.liveTabOverview,
                      l10n.liveTabPositions,
                      l10n.liveTabHistory,
                      l10n.liveTabParams,
                    ],
                    value: _labelFor(_tab, l10n),
                    onChanged: (String v) =>
                        setState(() => _tab = _keyFor(v, l10n)),
                  ),
                  const SizedBox(height: QzSpacing.md),
                  _tabBody(s),
                ],
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _StickyAction(status: s.status),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _tabBody(LiveStrategy s) {
    switch (_tab) {
      case 'positions':
        return _PositionsTab(id: s.id);
      case 'history':
        return _HistoryTab(id: s.id);
      case 'params':
        return _ParamsTab(id: s.id);
      case 'overview':
      default:
        return _OverviewTab(strategy: s);
    }
  }

  String _labelFor(String key, AppLocalizations l10n) {
    switch (key) {
      case 'positions':
        return l10n.liveTabPositions;
      case 'history':
        return l10n.liveTabHistory;
      case 'params':
        return l10n.liveTabParams;
      default:
        return l10n.liveTabOverview;
    }
  }

  String _keyFor(String label, AppLocalizations l10n) {
    if (label == l10n.liveTabPositions) return 'positions';
    if (label == l10n.liveTabHistory) return 'history';
    if (label == l10n.liveTabParams) return 'params';
    return 'overview';
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.strategy});
  final LiveStrategy strategy;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final LiveStatusStyle st = liveStatusStyle(strategy.status, c, l10n);
    final bool up = strategy.totalPct >= 0;

    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: c.bgSoft,
                  borderRadius: BorderRadius.circular(11),
                ),
                alignment: Alignment.center,
                child: Text(
                  strategy.exchangeGlyph,
                  style: TextStyle(
                    color: c.accent,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
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
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: st.bg,
                            borderRadius: BorderRadius.circular(5),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: <Widget>[
                              Container(
                                width: 5,
                                height: 5,
                                decoration: BoxDecoration(
                                  color: st.dot,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                st.label,
                                style: TextStyle(
                                  color: st.fg,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${strategy.pair} · ${strategy.timeframe} · '
                      '${strategy.market} · ${strategy.exchange}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.textDim,
                        fontSize: 11,
                        fontFamilyFallback: QzFont.monoFallback,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Text(
            l10n.liveDetailTotalPnl,
            style: TextStyle(color: c.textDim, fontSize: 11),
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Flexible(
                child: Text(
                  '${strategy.totalPnl >= 0 ? '+' : ''}'
                  '\$${strategy.totalPnl.abs().toStringAsFixed(2)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: up ? c.marketUp : c.marketDown,
                    fontSize: 30,
                    fontWeight: FontWeight.w700,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              QzChip(
                label:
                    '${strategy.totalPct >= 0 ? '+' : ''}'
                    '${strategy.totalPct.toStringAsFixed(2)}%',
                tone: up ? QzChipTone.ok : QzChipTone.danger,
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          LiveEquityCurve(points: strategy.spark, up: up),
          if (strategy.statusNote != null) ...<Widget>[
            const SizedBox(height: QzSpacing.md),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: QzSpacing.md,
                vertical: QzSpacing.sm,
              ),
              decoration: BoxDecoration(
                color: st.bg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                strategy.statusNote!,
                style: TextStyle(
                  color: st.fg,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.strategy});
  final LiveStrategy strategy;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<(String, String, Color)> stats = <(String, String, Color)>[
      (
        l10n.liveStatToday,
        '${strategy.todayPnl >= 0 ? '+' : ''}\$${strategy.todayPnl.abs().toStringAsFixed(2)}',
        strategy.todayPnl == 0
            ? c.text
            : (strategy.todayPnl > 0 ? c.marketUp : c.marketDown),
      ),
      (
        l10n.liveStatTodayPct,
        '${strategy.todayPct >= 0 ? '+' : ''}${strategy.todayPct.toStringAsFixed(2)}%',
        strategy.todayPct == 0
            ? c.text
            : (strategy.todayPct > 0 ? c.marketUp : c.marketDown),
      ),
      (
        l10n.liveStatTotalPct,
        '${strategy.totalPct >= 0 ? '+' : ''}${strategy.totalPct.toStringAsFixed(2)}%',
        strategy.totalPct >= 0 ? c.marketUp : c.marketDown,
      ),
      (l10n.liveStatCapital, '\$${strategy.capital.toStringAsFixed(0)}', c.text),
      (
        l10n.liveStatTrades,
        '${strategy.trades} ${l10n.liveStatTradesUnit}'.trim(),
        c.text,
      ),
      (l10n.liveStatWinRate, '${strategy.winRate.toStringAsFixed(1)}%', c.text),
      (l10n.liveStatRunFor, strategy.runFor, c.text),
      (l10n.liveStatExchange, strategy.exchange, c.text),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        QzCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: <Widget>[
              for (int row = 0; row < stats.length; row += 2)
                Row(
                  children: <Widget>[
                    Expanded(child: _StatCell(item: stats[row])),
                    Container(width: 1, height: 56, color: c.borderSoft),
                    Expanded(child: _StatCell(item: stats[row + 1])),
                  ],
                ),
            ],
          ),
        ),
        const SizedBox(height: QzSpacing.md),
        _AiObservation(status: strategy.status),
        const SizedBox(height: QzSpacing.md),
        Padding(
          padding: const EdgeInsets.only(bottom: QzSpacing.sm, left: 4),
          child: Text(
            l10n.liveArchiveSectionTitle,
            style: TextStyle(
              color: c.textMid,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        _ArchiveRow(
          icon: Icons.description_outlined,
          label: l10n.liveArchiveScript,
          sub: l10n.liveArchiveScriptSub,
        ),
        _ArchiveRow(
          icon: Icons.show_chart,
          label: l10n.liveArchiveBacktest,
          sub: l10n.liveArchiveBacktestSub,
        ),
        _ArchiveRow(
          icon: Icons.tune,
          label: l10n.liveArchiveDeploy,
          sub: l10n.liveArchiveDeploySub,
          last: true,
        ),
      ],
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({required this.item});
  final (String, String, Color) item;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(item.$1, style: TextStyle(color: c.textDim, fontSize: 11)),
          const SizedBox(height: 4),
          Text(
            item.$2,
            style: TextStyle(
              color: item.$3,
              fontSize: 16,
              fontWeight: FontWeight.w700,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ],
      ),
    );
  }
}

class _AiObservation extends StatelessWidget {
  const _AiObservation({required this.status});
  final LiveStrategyStatus status;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String text;
    switch (status) {
      case LiveStrategyStatus.warning:
        text = l10n.liveAiObservationWarning;
      case LiveStrategyStatus.paused:
      case LiveStrategyStatus.stopped:
        text = l10n.liveAiObservationPaused;
      case LiveStrategyStatus.running:
        text = l10n.liveAiObservationRunning;
    }
    return Container(
      padding: const EdgeInsets.all(QzSpacing.md),
      decoration: BoxDecoration(
        color: c.accentSoft,
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: c.accent,
              borderRadius: BorderRadius.circular(6),
            ),
            alignment: Alignment.center,
            child: Icon(Icons.smart_toy_outlined, size: 14, color: c.accentOn),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  '${l10n.liveAiObservationLabel}:',
                  style: TextStyle(
                    color: c.accent,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  text,
                  style: TextStyle(color: c.text, fontSize: 12, height: 1.65),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ArchiveRow extends StatelessWidget {
  const _ArchiveRow({
    required this.icon,
    required this.label,
    required this.sub,
    this.last = false,
  });
  final IconData icon;
  final String label;
  final String sub;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final BorderRadius radius = BorderRadius.vertical(
      top: const Radius.circular(QzRadii.card),
      bottom: last ? const Radius.circular(QzRadii.card) : Radius.zero,
    );
    return Material(
      color: c.bgElev,
      borderRadius: radius,
      child: InkWell(
        // 档案入口未接通：tap 提示「即将上线」，保持明确禁用语义。
        onTap: () => ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.liveArchiveComingSoon)),
        ),
        borderRadius: radius,
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(color: c.border),
              right: BorderSide(color: c.border),
              top: BorderSide(color: c.border),
              bottom: last ? BorderSide(color: c.border) : BorderSide.none,
            ),
            borderRadius: radius,
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: QzSpacing.md,
            vertical: QzSpacing.md,
          ),
          child: Row(
            children: <Widget>[
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: c.accentSoft,
                  borderRadius: BorderRadius.circular(9),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 16, color: c.accent),
              ),
              const SizedBox(width: QzSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      label,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      sub,
                      style: TextStyle(color: c.textDim, fontSize: 11),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, size: 18, color: c.textDim),
            ],
          ),
        ),
      ),
    );
  }
}

class _PositionsTab extends ConsumerWidget {
  const _PositionsTab({required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AsyncValue<LiveStrategyPosition?> pos =
        ref.watch(liveStrategyPositionProvider(id));
    return pos.when(
      loading: () => const Center(child: QzSpinner()),
      error: (Object e, StackTrace _) => const SizedBox.shrink(),
      data: (LiveStrategyPosition? p) {
        if (p == null) {
          return Container(
            padding: const EdgeInsets.symmetric(vertical: 42, horizontal: 20),
            decoration: BoxDecoration(
              color: c.bgElev,
              border: Border.all(color: c.border),
              borderRadius: BorderRadius.circular(QzRadii.card),
            ),
            child: Column(
              children: <Widget>[
                Icon(Icons.pause_circle_outline, size: 36, color: c.textDim),
                const SizedBox(height: QzSpacing.md),
                Text(
                  l10n.livePositionEmptyTitle,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  l10n.livePositionEmptyHint,
                  style: TextStyle(color: c.textMid, fontSize: 12),
                ),
              ],
            ),
          );
        }
        return _PositionCard(position: p);
      },
    );
  }
}

class _PositionCard extends StatelessWidget {
  const _PositionCard({required this.position});
  final LiveStrategyPosition position;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool long = position.side == PositionSide.long;
    final bool pnlUp = position.pnl >= 0;
    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: (long ? c.marketUp : c.marketDown)
                      .withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Text(
                  long ? l10n.livePositionSideLong : l10n.livePositionSideShort,
                  style: TextStyle(
                    color: long ? c.marketUp : c.marketDown,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              Text(
                position.pair,
                style: TextStyle(
                  color: c.text,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              Text(
                '×${position.qty}',
                style: TextStyle(
                  color: c.textDim,
                  fontSize: 11,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
              const Spacer(),
              Flexible(
                child: Text(
                  '${pnlUp ? '+' : ''}\$${position.pnl.abs().toStringAsFixed(2)} · '
                  '${position.pct >= 0 ? '+' : ''}${position.pct.toStringAsFixed(2)}%',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    color: pnlUp ? c.marketUp : c.marketDown,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Row(
            children: <Widget>[
              Expanded(
                child: _PriceCell(
                  label: l10n.livePositionEntry,
                  value: '\$${position.entryPrice.toStringAsFixed(2)}',
                  align: CrossAxisAlignment.start,
                ),
              ),
              Expanded(
                child: _PriceCell(
                  label: l10n.livePositionCurrent,
                  value: '\$${position.currentPrice.toStringAsFixed(2)}',
                  align: CrossAxisAlignment.center,
                ),
              ),
              Expanded(
                child: _PriceCell(
                  label: l10n.livePositionStop,
                  value: '\$${position.stopPrice.toStringAsFixed(2)}',
                  align: CrossAxisAlignment.end,
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Flexible(
                child: Text(
                  l10n.livePositionStopLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: c.statusDanger, fontSize: 10),
                ),
              ),
              Flexible(
                child: Text(
                  '${l10n.livePositionStopDistance} ${position.stopDistance}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: c.textDim, fontSize: 10),
                ),
              ),
              Flexible(
                child: Text(
                  '${l10n.livePositionHold} ${position.holdFor}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                  style: TextStyle(color: c.text, fontSize: 10),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PriceCell extends StatelessWidget {
  const _PriceCell({
    required this.label,
    required this.value,
    required this.align,
  });
  final String label;
  final String value;
  final CrossAxisAlignment align;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final TextAlign ta = align == CrossAxisAlignment.start
        ? TextAlign.left
        : align == CrossAxisAlignment.end
            ? TextAlign.right
            : TextAlign.center;
    return Column(
      crossAxisAlignment: align,
      children: <Widget>[
        Text(label, style: TextStyle(color: c.textDim, fontSize: 10)),
        const SizedBox(height: 3),
        Text(
          value,
          textAlign: ta,
          style: TextStyle(
            color: c.text,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _HistoryTab extends ConsumerWidget {
  const _HistoryTab({required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AsyncValue<List<LiveStrategyTrade>> trades =
        ref.watch(liveStrategyTradesProvider(id));
    return trades.when(
      loading: () => const Center(child: QzSpinner()),
      error: (Object e, StackTrace _) => const SizedBox.shrink(),
      data: (List<LiveStrategyTrade> list) => QzCard(
        padding: EdgeInsets.zero,
        child: Column(
          children: <Widget>[
            for (int i = 0; i < list.length; i++)
              Container(
                decoration: BoxDecoration(
                  border: Border(
                    top: i == 0
                        ? BorderSide.none
                        : BorderSide(color: c.borderSoft),
                  ),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: QzSpacing.md,
                  vertical: QzSpacing.md,
                ),
                child: _TradeRow(trade: list[i], l10n: l10n),
              ),
          ],
        ),
      ),
    );
  }
}

class _TradeRow extends StatelessWidget {
  const _TradeRow({required this.trade, required this.l10n});
  final LiveStrategyTrade trade;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool long = trade.side == PositionSide.long;
    return Row(
      children: <Widget>[
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: (trade.win ? c.marketUp : c.marketDown)
                .withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(6),
          ),
          alignment: Alignment.center,
          child: Text(
            long ? l10n.livePositionSideLong : l10n.livePositionSideShort,
            style: TextStyle(
              color: trade.win ? c.marketUp : c.marketDown,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: QzSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                '${trade.entryPrice.toStringAsFixed(1)} → '
                '${trade.exitPrice.toStringAsFixed(1)}',
                style: TextStyle(
                  color: c.text,
                  fontSize: 12,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${trade.time} · ${l10n.livePositionHold} ${trade.holdFor}',
                style: TextStyle(
                  color: c.textDim,
                  fontSize: 10,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
            ],
          ),
        ),
        Text(
          '${trade.pct >= 0 ? '+' : ''}${trade.pct.toStringAsFixed(2)}%',
          style: TextStyle(
            color: trade.win ? c.marketUp : c.marketDown,
            fontSize: 14,
            fontWeight: FontWeight.w700,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _ParamsTab extends ConsumerWidget {
  const _ParamsTab({required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AsyncValue<List<LiveStrategyParam>> params =
        ref.watch(liveStrategyParamsProvider(id));
    return params.when(
      loading: () => const Center(child: QzSpinner()),
      error: (Object e, StackTrace _) => const SizedBox.shrink(),
      data: (List<LiveStrategyParam> list) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          QzCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: <Widget>[
                for (int i = 0; i < list.length; i++)
                  Container(
                    decoration: BoxDecoration(
                      border: Border(
                        top: i == 0
                            ? BorderSide.none
                            : BorderSide(color: c.borderSoft),
                      ),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: QzSpacing.md,
                      vertical: QzSpacing.md,
                    ),
                    child: Row(
                      children: <Widget>[
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                list[i].key,
                                style: TextStyle(
                                  color: c.text,
                                  fontSize: 13,
                                  fontFamilyFallback: QzFont.monoFallback,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                list[i].note,
                                style: TextStyle(
                                  color: c.textDim,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          list[i].value,
                          style: TextStyle(
                            color: c.text,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            fontFamilyFallback: QzFont.monoFallback,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: QzSpacing.md),
          OutlinedButton.icon(
            // 调优入口未接通：占位提示。
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(l10n.liveActionComingSoon)),
            ),
            icon: Icon(Icons.smart_toy_outlined, size: 14, color: c.accent),
            label: Text(
              l10n.liveParamsTuneInAi,
              style: TextStyle(color: c.accent),
            ),
          ),
        ],
      ),
    );
  }
}

/// 底部 sticky 主操作。本迭代写操作未接通，按钮禁用 + tap 占位提示。
class _StickyAction extends StatelessWidget {
  const _StickyAction({required this.status});
  final LiveStrategyStatus status;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool stopped = status == LiveStrategyStatus.stopped;
    final bool canStart = status == LiveStrategyStatus.paused ||
        status == LiveStrategyStatus.warning;
    final String primary = stopped
        ? l10n.liveActionResume
        : canStart
            ? l10n.liveActionStart
            : l10n.liveActionPause;
    void comingSoon() => ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.liveActionComingSoon)),
        );

    return Container(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.md,
        QzSpacing.lg,
        QzSpacing.xl,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[c.bg.withValues(alpha: 0), c.bg],
        ),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: OutlinedButton(
              key: const Key('live-delete-button'),
              onPressed: comingSoon,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                side: BorderSide(color: c.statusDanger.withValues(alpha: 0.4)),
              ),
              child: Text(
                stopped ? l10n.liveActionDeletePermanent : l10n.liveActionDelete,
                style: TextStyle(color: c.statusDanger),
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            flex: 2,
            child: FilledButton(
              key: const Key('live-primary-action'),
              onPressed: comingSoon,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                backgroundColor: c.accent,
              ),
              child: Text(primary),
            ),
          ),
        ],
      ),
    );
  }
}
