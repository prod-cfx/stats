part of 'market_detail_page.dart';

class _MarketChartSection extends StatelessWidget {
  const _MarketChartSection({required this.stats, required this.chart});

  final Widget stats;
  final Widget chart;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return DecoratedBox(
      decoration: BoxDecoration(color: c.bgElev),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[stats, chart],
      ),
    );
  }
}

/// 3 段 underline panel tab：盘口 / 成交 / 深度图（#1563）。
class _PanelSection extends StatelessWidget {
  const _PanelSection({required this.tabBar, required this.body});

  final Widget tabBar;
  final Widget body;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.only(bottom: QzSpacing.xxl),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(top: BorderSide(color: c.bg, width: 6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[tabBar, body],
      ),
    );
  }
}

class _PanelTabBar extends StatelessWidget {
  const _PanelTabBar({required this.panel, required this.onChanged});

  final DetailPanel panel;
  final ValueChanged<DetailPanel> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<(DetailPanel, String)> items = <(DetailPanel, String)>[
      (DetailPanel.book, l10n.marketDetailPanelOrderbook),
      (DetailPanel.trades, l10n.marketDetailPanelTrades),
      (DetailPanel.depth, l10n.marketDetailPanelDepth),
    ];
    return Container(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.md,
        QzSpacing.lg,
        0,
      ),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          for (final (DetailPanel key, String label) in items)
            Padding(
              padding: const EdgeInsets.only(right: 18),
              child: _PanelTab(
                label: label,
                selected: panel == key,
                onTap: () => onChanged(key),
              ),
            ),
        ],
      ),
    );
  }
}

class _PanelTab extends StatelessWidget {
  const _PanelTab({
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
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.only(top: 6, bottom: 8),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: selected ? c.text : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? c.text : c.textMid,
            fontSize: 13,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _PanelBody extends StatelessWidget {
  const _PanelBody({
    required this.panel,
    required this.symbol,
    required this.mid,
    required this.changePercent,
    required this.trades,
  });

  final DetailPanel panel;
  final String symbol;
  final double mid;
  final double changePercent;
  final List<Trade> trades;

  @override
  Widget build(BuildContext context) {
    switch (panel) {
      case DetailPanel.book:
        return OrderbookView(
          symbol: symbol,
          mid: mid,
          changePercent: changePercent,
        );
      case DetailPanel.trades:
        return TradesPanel(symbol: symbol, mid: mid, trades: trades);
      case DetailPanel.depth:
        return DepthPanel(symbol: symbol, mid: mid);
    }
  }
}
