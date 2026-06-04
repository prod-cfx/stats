part of 'live_strategy_detail_page.dart';

class _DetailTabs extends StatelessWidget {
  const _DetailTabs({
    required this.options,
    required this.value,
    required this.onChanged,
  });

  final List<String> options;
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      height: 38,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: c.bgSoft,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: <Widget>[
          for (final String opt in options)
            Expanded(
              child: _DetailTabButton(
                label: opt,
                selected: opt == value,
                onTap: () => onChanged(opt),
              ),
            ),
        ],
      ),
    );
  }
}

class _DetailTabButton extends StatelessWidget {
  const _DetailTabButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final BorderRadius radius = BorderRadius.circular(7);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: radius,
        child: Container(
          height: 32,
          decoration: BoxDecoration(
            color: selected ? c.bgElev : Colors.transparent,
            borderRadius: radius,
            boxShadow: selected ? QzShadow.lightSm : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: selected ? c.accent : c.textMid,
              fontSize: 12,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
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
                    fontFamily: QzFont.mono,
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
      (
        l10n.liveStatCapital,
        '\$${strategy.capital.toStringAsFixed(0)}',
        c.text,
      ),
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
              fontFamily: QzFont.mono,
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
        // 脚本/回测/部署档案依赖真实部署数据（future），本迭代保持禁用占位。
        onTap: () => ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.liveArchiveComingSoon))),
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
                    Text(sub, style: TextStyle(color: c.textDim, fontSize: 11)),
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
