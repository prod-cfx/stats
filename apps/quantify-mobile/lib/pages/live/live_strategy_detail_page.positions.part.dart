part of 'live_strategy_detail_page.dart';

class _PositionsTab extends ConsumerWidget {
  const _PositionsTab({required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AsyncValue<LiveStrategyPosition?> pos = ref.watch(
      liveStrategyPositionProvider(id),
    );
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
                  color: (long ? c.marketUp : c.marketDown).withValues(
                    alpha: 0.14,
                  ),
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
                  fontFamily: QzFont.mono,
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
                    fontFamily: QzFont.mono,
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
            crossAxisAlignment: CrossAxisAlignment.center,
            children: <Widget>[
              Text(
                l10n.livePositionStopLabel,
                softWrap: false,
                style: TextStyle(color: c.statusDanger, fontSize: 10),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: RichText(
                  textAlign: TextAlign.center,
                  overflow: TextOverflow.ellipsis,
                  text: TextSpan(
                    style: TextStyle(color: c.textDim, fontSize: 10),
                    children: <InlineSpan>[
                      TextSpan(text: '${l10n.livePositionStopDistance} '),
                      TextSpan(
                        text: position.stopDistance,
                        style: TextStyle(color: c.text),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '${l10n.livePositionHold} ${position.holdFor}',
                softWrap: false,
                textAlign: TextAlign.right,
                style: TextStyle(color: c.text, fontSize: 10),
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
            fontFamily: QzFont.mono,
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
    final AsyncValue<List<LiveStrategyTrade>> trades = ref.watch(
      liveStrategyTradesProvider(id),
    );
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
            color: (trade.win ? c.marketUp : c.marketDown).withValues(
              alpha: 0.14,
            ),
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
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${trade.time} · ${l10n.livePositionHold} ${trade.holdFor}',
                style: TextStyle(
                  color: c.textDim,
                  fontSize: 10,
                  fontFamily: QzFont.mono,
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
            fontFamily: QzFont.mono,
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
    final AsyncValue<List<LiveStrategyParam>> params = ref.watch(
      liveStrategyParamsProvider(id),
    );
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
                                  fontFamily: QzFont.mono,
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
                            fontFamily: QzFont.mono,
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
            key: const Key('live-tune-in-ai'),
            // 复用已接通的 `/ai?loadStrategy=<id>` query 链路（#1773）。
            onPressed: () => context.go('/ai?loadStrategy=$id'),
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

/// 底部 sticky 主操作（#1773）。开启/暂停/恢复/删除走 mock 状态转换。
///
/// - 主按钮：running → 暂停（有持仓先弹处理对话框）；paused/warning →
///   开启；stopped → 恢复。
/// - 删除按钮：running → 先弹「需暂停」守卫；其余 → 删除确认（软删/永久）。
class _StickyAction extends ConsumerWidget {
  const _StickyAction({required this.strategy});
  final LiveStrategy strategy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final LiveStrategyStatus status = strategy.status;
    final bool stopped = status == LiveStrategyStatus.stopped;
    final bool canStart =
        status == LiveStrategyStatus.paused ||
        status == LiveStrategyStatus.warning;
    final String primary = stopped
        ? l10n.liveActionResume
        : canStart
        ? l10n.liveActionStart
        : l10n.liveActionPause;

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
              onPressed: () => _onDelete(context, ref),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                backgroundColor: c.bgElev,
                foregroundColor: c.statusDanger,
                side: BorderSide(color: c.statusDanger.withValues(alpha: 0.4)),
              ),
              child: Text(
                stopped
                    ? l10n.liveActionDeletePermanent
                    : l10n.liveActionDelete,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            flex: 2,
            child: FilledButton(
              key: const Key('live-primary-action'),
              onPressed: () => _onPrimary(context, ref),
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

  Future<void> _onPrimary(BuildContext context, WidgetRef ref) async {
    final LiveStrategyStore store = ref.read(
      liveStrategyStoreProvider.notifier,
    );
    switch (strategy.status) {
      case LiveStrategyStatus.paused:
      case LiveStrategyStatus.warning:
      case LiveStrategyStatus.stopped:
        store.resume(strategy.id);
      case LiveStrategyStatus.running:
        await _pauseRunning(context, ref, store);
    }
  }

  Future<void> _pauseRunning(
    BuildContext context,
    WidgetRef ref,
    LiveStrategyStore store,
  ) async {
    final LiveStrategyPosition? position = await ref.read(
      liveStrategyPositionProvider(strategy.id).future,
    );
    if (!context.mounted) return;
    if (position == null) {
      store.pause(strategy.id);
      return;
    }
    final LivePauseMode? mode = await LiveCloseWithPositionSheet.show(
      context,
      strategy: strategy,
      position: position,
    );
    if (mode == null) return;
    store.pause(strategy.id);
  }

  Future<void> _onDelete(BuildContext context, WidgetRef ref) async {
    final LiveStrategyStore store = ref.read(
      liveStrategyStoreProvider.notifier,
    );
    if (strategy.status == LiveStrategyStatus.running) {
      final bool? goPause = await LiveNeedPauseSheet.show(
        context,
        name: strategy.name,
      );
      if (goPause != true || !context.mounted) return;
      await _pauseRunning(context, ref, store);
      return;
    }
    final bool stopped = strategy.status == LiveStrategyStatus.stopped;
    final bool? permanent = await LiveDeleteSheet.show(
      context,
      name: strategy.name,
      stopped: stopped,
    );
    if (permanent == null || !context.mounted) return;
    if (permanent) {
      store.permanentDelete(strategy.id);
    } else {
      store.softDelete(strategy.id);
    }
    if (context.mounted) context.pop();
  }
}
