part of 'strategy_detail_page.dart';
// ignore_for_file: unused_element

/// equity 时间维度切换 tab（#1565）。
class _EquityTabBar extends StatelessWidget {
  const _EquityTabBar({required this.selected, required this.onChanged});

  final EquityTimeframe selected;
  final ValueChanged<EquityTimeframe> onChanged;

  String _label(BuildContext ctx, EquityTimeframe t) {
    final AppLocalizations l10n = AppLocalizations.of(ctx);
    return switch (t) {
      EquityTimeframe.d7 => l10n.strategyDetailEquityTab7d,
      EquityTimeframe.d30 => l10n.strategyDetailEquityTab30d,
      EquityTimeframe.d90 => l10n.strategyDetailEquityTab90d,
      EquityTimeframe.y1 => l10n.strategyDetailEquityTab1y,
    };
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        for (final EquityTimeframe t in EquityTimeframe.values)
          Padding(
            padding: const EdgeInsets.only(left: 2),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                key: Key('strategy-detail-tf-${t.name}'),
                onTap: () => onChanged(t),
                borderRadius: BorderRadius.circular(4),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: QzSpacing.xs,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: t == selected ? c.accentSoft : Colors.transparent,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    _label(context, t),
                    style: TextStyle(
                      color: t == selected ? c.accent : c.textDim,
                      fontSize: 10,
                      fontWeight: t == selected
                          ? FontWeight.w600
                          : FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _EquitySection extends ConsumerWidget {
  const _EquitySection({required this.id, required this.tf});

  final String id;
  final EquityTimeframe tf;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<double>> async = ref.watch(
      strategyEquityProvider((id: id, tf: tf)),
    );
    return SizedBox(
      key: const Key('strategy-detail-equity-section'),
      height: 120,
      child: async.when(
        loading: () => const Center(child: QzSpinner()),
        error: (Object e, _) =>
            Center(child: Text(AppLocalizations.of(context).commonLoadError)),
        data: (List<double> pts) => EquityCurveView(data: pts),
      ),
    );
  }
}

/// 策略参数（#1565）：类型 / 品种 / 周期 / 止损 / 仓位 / 杠杆。
///
/// 读取 strategy-plaza 模板契约的 symbol/timeframe/position/leverage/params。
/// params 未给到的字段显示 `--`，不再派生假参数。
class _ParamsSection extends StatelessWidget {
  const _ParamsSection({required this.detail});
  final StrategyDetail detail;

  StrategyCard get card => detail.card;

  String _categoryLabel(BuildContext ctx) {
    final AppLocalizations l10n = AppLocalizations.of(ctx);
    return switch (card.category) {
      StrategyCategory.all => l10n.commonAll,
      StrategyCategory.trend => l10n.strategyCategoryTrend,
      StrategyCategory.grid => l10n.strategyCategoryGrid,
      StrategyCategory.arbitrage => l10n.strategyCategoryArbitrage,
      StrategyCategory.reversal => l10n.strategyCategoryReversal,
      StrategyCategory.hedge => l10n.strategyCategoryHedge,
      StrategyCategory.highFreq => l10n.strategyCategoryHighFreq,
    };
  }

  String _symbol() {
    if (card.pair.trim().isNotEmpty) {
      return card.pair.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').toUpperCase();
    }
    // 仅取明显是交易对的 tag（按报价单位后缀匹配），
    // 避免把 grid / dca / momentum 等策略类型误判成交易对。
    for (final String t in card.tags) {
      final String up = t.toUpperCase();
      if (up.endsWith('USDT') ||
          up.endsWith('USDC') ||
          up.endsWith('USD') ||
          up.endsWith('BTC') ||
          up.endsWith('ETH')) {
        return up;
      }
    }
    return '—';
  }

  /// 交易周期：直接取 [StrategyCard.period]（如 `30D`），缺省回退 `—`。
  String _period() => card.period.isNotEmpty ? card.period : '—';

  String _marketType() => detail.marketType.isEmpty ? '—' : detail.marketType;

  String _pct(double? value) =>
      value == null ? '—' : '${value.toStringAsFixed(0)}%';

  String _leverage() {
    final double? value = detail.leverage;
    if (value == null || value <= 0) {
      final bool hasContractParams =
          detail.marketType.isNotEmpty ||
          detail.positionPct != null ||
          detail.params.isNotEmpty;
      if (!hasContractParams) {
        return card.category == StrategyCategory.highFreq ? '5×' : '1×';
      }
      return '无杠杆';
    }
    return '${value.toStringAsFixed(value.truncateToDouble() == value ? 0 : 1)}×';
  }

  String _paramValue(List<String> keys) {
    for (final String key in keys) {
      final double? value = detail.params[key];
      if (value != null) {
        return '${value.toStringAsFixed(value.truncateToDouble() == value ? 0 : 2)}%';
      }
    }
    return '—';
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<({String label, String value})> rows =
        <({String label, String value})>[
          (label: l10n.strategyDetailParamType, value: _categoryLabel(context)),
          (label: '市场', value: _marketType()),
          (label: l10n.strategyDetailParamSymbol, value: _symbol()),
          (label: l10n.strategyDetailParamPeriod, value: _period()),
          (
            label: l10n.strategyDetailParamStopLoss,
            value: _paramValue(<String>[
              'stopLossPct',
              'stop_loss',
              'stopLoss',
            ]),
          ),
          (
            label: l10n.strategyDetailParamPosition,
            value: _pct(detail.positionPct),
          ),
          (label: l10n.strategyDetailParamLeverage, value: _leverage()),
        ];
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
      child: Column(
        children: <Widget>[
          for (int i = 0; i < rows.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(vertical: QzSpacing.sm),
              decoration: BoxDecoration(
                border: Border(
                  bottom: i < rows.length - 1
                      ? BorderSide(color: c.borderSoft, width: 0.5)
                      : BorderSide.none,
                ),
              ),
              child: Row(
                children: <Widget>[
                  Text(
                    rows[i].label,
                    style: TextStyle(color: c.textDim, fontSize: 12),
                  ),
                  const Spacer(),
                  Text(
                    rows[i].value,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      fontFeatures: const <FontFeature>[
                        FontFeature.tabularFigures(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// equity 卡（对齐设计稿 StratDetail equity 卡，#1825）：
/// 左上大号 `+CAGR%` + 「{period} 累计收益」+ 右侧时间维度 tab，下方曲线。
class _EquityCard extends StatelessWidget {
  const _EquityCard({
    required this.cagr,
    required this.tf,
    required this.onChanged,
    required this.curve,
  });

  final double cagr;
  final EquityTimeframe tf;
  final ValueChanged<EquityTimeframe> onChanged;
  final Widget curve;

  String _periodLabel(BuildContext ctx, EquityTimeframe t) {
    final AppLocalizations l10n = AppLocalizations.of(ctx);
    return switch (t) {
      EquityTimeframe.d7 => l10n.strategyDetailEquityTab7d,
      EquityTimeframe.d30 => l10n.strategyDetailEquityTab30d,
      EquityTimeframe.d90 => l10n.strategyDetailEquityTab90d,
      EquityTimeframe.y1 => l10n.strategyDetailEquityTab1y,
    };
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool up = cagr >= 0;
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: const EdgeInsets.all(QzSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Text(
                '${up ? '+' : ''}${cagr.toStringAsFixed(1)}%',
                style: TextStyle(
                  color: up ? c.marketUp : c.marketDown,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const <FontFeature>[
                    FontFeature.tabularFigures(),
                  ],
                ),
              ),
              const SizedBox(width: QzSpacing.xs),
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text(
                  l10n.strategyDetailCumulativeReturn(
                    _periodLabel(context, tf),
                  ),
                  style: TextStyle(color: c.textDim, fontSize: 11),
                ),
              ),
              const Spacer(),
              _EquityTabBar(selected: tf, onChanged: onChanged),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          curve,
        ],
      ),
    );
  }
}

/// 策略说明段（对齐设计稿 StratDetail description，#1825）：
/// 基于 [StrategyCard.description] + 类型派生一段固定说明文本。
class _DescriptionSection extends StatelessWidget {
  const _DescriptionSection({required this.card});
  final StrategyCard card;

  String _categoryLabel(BuildContext ctx) {
    final AppLocalizations l10n = AppLocalizations.of(ctx);
    return switch (card.category) {
      StrategyCategory.all => l10n.commonAll,
      StrategyCategory.trend => l10n.strategyCategoryTrend,
      StrategyCategory.grid => l10n.strategyCategoryGrid,
      StrategyCategory.arbitrage => l10n.strategyCategoryArbitrage,
      StrategyCategory.reversal => l10n.strategyCategoryReversal,
      StrategyCategory.hedge => l10n.strategyCategoryHedge,
      StrategyCategory.highFreq => l10n.strategyCategoryHighFreq,
    };
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String desc = card.description.isEmpty ? '' : '${card.description} ';
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: const EdgeInsets.all(QzSpacing.md),
      child: Text(
        l10n.strategyDetailDescriptionBody(desc, _categoryLabel(context)),
        style: TextStyle(color: c.text, fontSize: 13, height: 1.6),
      ),
    );
  }
}
