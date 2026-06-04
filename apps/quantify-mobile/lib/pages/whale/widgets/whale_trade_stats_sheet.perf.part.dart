part of 'whale_trade_stats_sheet.dart';
// ignore_for_file: unused_element

class _PerfTabs extends StatelessWidget {
  const _PerfTabs({required this.value, required this.onChanged});
  final _PerfTab value;
  final ValueChanged<_PerfTab> onChanged;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<(_PerfTab, String)> tabs = <(_PerfTab, String)>[
      (_PerfTab.asset, l10n.whaleTradeStatsByAsset),
      (_PerfTab.position, l10n.whaleTradeStatsByPosition),
    ];
    return Container(
      padding: const EdgeInsets.fromLTRB(QzSpacing.lg, 10, QzSpacing.lg, 0),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          for (final (_PerfTab, String) t in tabs)
            GestureDetector(
              onTap: () => onChanged(t.$1),
              child: Padding(
                padding: const EdgeInsets.only(right: 18),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: t.$1 == value ? c.accent : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                  child: Text(
                    t.$2,
                    style: TextStyle(
                      color: t.$1 == value ? c.accent : c.textMid,
                      fontSize: 12,
                      fontWeight: t.$1 == value
                          ? FontWeight.w700
                          : FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PerfList extends StatelessWidget {
  const _PerfList({required this.stats, required this.tab});
  final WhaleTradeStats stats;
  final _PerfTab tab;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    // 设计稿 jsx:2334：tradesTotal==0 || winRate<0.01（winRate 为分数 0..1，
    // 对应此处 winRatePct 为整数百分比 0..100，winRate<0.01 即 winRatePct<1）
    // → 视为无有效成交，展示空态。
    final bool empty = (stats.tradesTotal ?? 0) == 0 || stats.winRatePct < 1;
    if (empty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Center(
          child: Text(
            l10n.whaleTradeStatsEmpty,
            style: TextStyle(color: c.textFaint, fontSize: 12),
          ),
        ),
      );
    }

    final List<_PerfRowData> rows = tab == _PerfTab.asset
        ? stats.assetPerf.map(_PerfRowData.fromAsset).toList()
        : stats.positionPerf.map(_PerfRowData.fromPosition).toList();

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        4,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
        decoration: BoxDecoration(
          color: c.bgElev,
          border: Border.all(color: c.borderSoft),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          children: <Widget>[
            for (int i = 0; i < rows.length; i++)
              _PerfRow(data: rows[i], isLast: i == rows.length - 1),
          ],
        ),
      ),
    );
  }
}

/// PerfRow 归一化数据：资产行与仓位行共用同一渲染，差异收敛到 [isPosition] /
/// 可选字段，避免两套 widget。
class _PerfRowData {
  const _PerfRowData({
    required this.name,
    required this.glyph,
    required this.colorHex,
    required this.positive,
    required this.pnlDisplay,
    required this.feeDisplay,
    required this.isPosition,
    this.side,
    this.tradeCount,
    this.timeDisplay,
    this.sizeDisplay,
  });

  factory _PerfRowData.fromAsset(WhaleAssetPerf a) {
    return _PerfRowData(
      name: a.symbol,
      glyph: (a.glyph != null && a.glyph!.isNotEmpty)
          ? a.glyph!
          : (a.symbol.isEmpty ? '?' : a.symbol[0]),
      colorHex: a.colorHex,
      positive: a.positive ?? (a.tone == 'up'),
      pnlDisplay: a.pnlDisplay ?? '',
      feeDisplay: a.feeDisplay ?? '',
      isPosition: false,
      tradeCount: a.tradeCount,
    );
  }

  factory _PerfRowData.fromPosition(WhalePositionPerf p) {
    return _PerfRowData(
      name: p.label ?? p.sym,
      glyph: p.glyph.isEmpty ? (p.sym.isEmpty ? '?' : p.sym[0]) : p.glyph,
      colorHex: p.colorHex,
      positive: p.positive,
      pnlDisplay: p.pnlDisplay,
      feeDisplay: p.feeDisplay,
      isPosition: true,
      side: p.side,
      timeDisplay: p.timeDisplay,
      sizeDisplay: p.sizeDisplay,
    );
  }

  final String name;
  final String glyph;
  final int? colorHex;
  final bool positive;
  final String pnlDisplay;
  final String feeDisplay;
  final bool isPosition;
  final String? side;
  final int? tradeCount;
  final String? timeDisplay;
  final String? sizeDisplay;
}

class _PerfRow extends StatelessWidget {
  const _PerfRow({required this.data, required this.isLast});
  final _PerfRowData data;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final Color pnlColor = data.positive ? c.marketUp : c.marketDown;
    final String subtitle = data.isPosition
        ? (data.timeDisplay ?? '')
        : l10n.whaleTradeStatsTradeUnit(data.tradeCount ?? 0);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: isLast ? Colors.transparent : c.borderSoft),
        ),
      ),
      child: Column(
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: data.colorHex != null
                      ? Color(data.colorHex!)
                      : c.accent,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  data.glyph,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    fontFamily: QzFont.mono,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Flexible(
                          child: Text(
                            data.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: c.text,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        if (data.side != null) ...<Widget>[
                          const SizedBox(width: 7),
                          _SidePill(side: data.side!),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: TextStyle(color: c.textDim, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                _fmtMoney(data.positive, data.pnlDisplay),
                style: TextStyle(
                  color: pnlColor,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  fontFamily: QzFont.mono,
                ),
              ),
            ],
          ),
          const SizedBox(height: 11),
          Row(
            children: <Widget>[
              Expanded(
                child: _PerfMetric(
                  label: data.isPosition
                      ? l10n.whaleTradeStatsSize
                      : l10n.whaleTradeStatsNetPnl,
                  value: data.isPosition
                      ? (data.sizeDisplay ?? '')
                      : _fmtMoney(data.positive, data.pnlDisplay),
                  color: data.isPosition ? c.text : pnlColor,
                  alignEnd: false,
                ),
              ),
              Expanded(
                child: _PerfMetric(
                  label: l10n.whaleTradeStatsFee,
                  value: _fmtMoney(true, data.feeDisplay),
                  color: c.marketUp,
                  alignEnd: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SidePill extends StatelessWidget {
  const _SidePill({required this.side});
  final String side;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool isLong = side == l10n.whaleProfileLong;
    final Color fg = isLong ? c.marketUp : c.marketDown;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: fg.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        side,
        style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _PerfMetric extends StatelessWidget {
  const _PerfMetric({
    required this.label,
    required this.value,
    required this.color,
    required this.alignEnd,
  });
  final String label;
  final String value;
  final Color color;
  final bool alignEnd;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: alignEnd
          ? CrossAxisAlignment.end
          : CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: TextStyle(color: c.textDim, fontSize: 11.5)),
        const SizedBox(height: 4),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontSize: 13.5,
            fontWeight: FontWeight.w600,
            fontFamily: QzFont.mono,
          ),
        ),
      ],
    );
  }
}

/// "$ +181,101.72" / "$ −496.25" —— 美元符 + 空格 + 正负号 + 数字（设计稿
/// `fmtMoney`，负号用 U+2212 与设计一致）。
String _fmtMoney(bool positive, String num) {
  return '\$ ${positive ? '+' : '−'}$num';
}
