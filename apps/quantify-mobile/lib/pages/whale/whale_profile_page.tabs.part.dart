part of 'whale_profile_page.dart';
// ignore_for_file: unused_element

/// 现货持仓：价值/金额 排序 + 价格 排序 + 筛选。
class _SpotTab extends StatelessWidget {
  const _SpotTab({required this.items, required this.empty});
  final List<WhaleSpotHolding> items;
  final String empty;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return _SortableTab<WhaleSpotHolding>(
      tabId: 'spot',
      items: items,
      empty: empty,
      symOf: (WhaleSpotHolding h) => h.sym,
      filterLabel: l10n.whaleProfileFilterLabel,
      leftKeys: <_SortKey<WhaleSpotHolding>>[
        _SortKey<WhaleSpotHolding>(
          'value',
          l10n.whaleProfileSortValue,
          numOf: (h) => h.valueN,
        ),
        _SortKey<WhaleSpotHolding>(
          'amount',
          l10n.whaleProfileSortAmount,
          numOf: (h) => whaleSortNum(h.qtyDisplay),
        ),
      ],
      rightKeys: <_SortKey<WhaleSpotHolding>>[
        _SortKey<WhaleSpotHolding>(
          'price',
          l10n.whaleProfileColPrice,
          right: true,
          numOf: (h) => whaleSortNum(h.priceDisplay),
        ),
      ],
      rowBuilder: (WhaleSpotHolding h) => WhaleSpotRow(h: h),
    );
  }
}

/// 永续合约持仓：持仓价值/未实现盈亏 排序 + 筛选 + 更多排序。
class _PerpTab extends StatelessWidget {
  const _PerpTab({required this.items, required this.empty});
  final List<WhalePerpHolding> items;
  final String empty;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return _SortableTab<WhalePerpHolding>(
      tabId: 'perp',
      items: items,
      empty: empty,
      symOf: (WhalePerpHolding h) => h.sym,
      leftKeys: <_SortKey<WhalePerpHolding>>[
        _SortKey<WhalePerpHolding>(
          'value',
          l10n.whaleProfileColPosValue,
          numOf: (h) => h.valueN,
        ),
        _SortKey<WhalePerpHolding>(
          'pnl',
          l10n.whaleProfileColUnrealized,
          numOf: (h) => h.pnlN,
        ),
      ],
      rightKeys: const <_SortKey<WhalePerpHolding>>[],
      moreSortKeys: <_SortKey<WhalePerpHolding>>[
        _SortKey<WhalePerpHolding>(
          'entry',
          l10n.whaleProfileColEntry,
          numOf: (h) => whaleSortNum(h.entryDisplay),
        ),
        _SortKey<WhalePerpHolding>(
          'mark',
          l10n.whaleProfileColMark,
          numOf: (h) => whaleSortNum(h.markDisplay),
        ),
        _SortKey<WhalePerpHolding>(
          'liq',
          l10n.whaleProfileColLiq,
          numOf: (h) => whaleSortNum(h.liqDisplay),
        ),
        _SortKey<WhalePerpHolding>(
          'margin',
          l10n.whaleProfileColMargin,
          numOf: (h) => whaleSortNum(h.marginDisplay),
        ),
        _SortKey<WhalePerpHolding>(
          'funding',
          l10n.whaleProfileColFunding,
          numOf: (h) => h.fundingN,
        ),
      ],
      rowBuilder: (WhalePerpHolding h) => WhalePerpRow(h: h),
    );
  }
}

/// 挂单：时间/价值 排序 + 数量 排序 + 筛选。
class _OrderTab extends StatelessWidget {
  const _OrderTab({required this.items, required this.empty});
  final List<WhaleOpenOrder> items;
  final String empty;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return _SortableTab<WhaleOpenOrder>(
      tabId: 'order',
      items: items,
      empty: empty,
      symOf: (WhaleOpenOrder o) => o.sym,
      leftKeys: <_SortKey<WhaleOpenOrder>>[
        _SortKey<WhaleOpenOrder>('time', l10n.whaleProfileColTime),
        _SortKey<WhaleOpenOrder>(
          'value',
          l10n.whaleProfileColValue,
          numOf: (o) => whaleSortNum(o.valueDisplay),
        ),
      ],
      rightKeys: <_SortKey<WhaleOpenOrder>>[
        _SortKey<WhaleOpenOrder>(
          'qty',
          l10n.whaleProfileColQty,
          right: true,
          numOf: (o) => whaleSortNum(o.qtyDisplay),
        ),
      ],
      rowBuilder: (WhaleOpenOrder o) => WhaleOrderRow(o: o),
    );
  }
}

/// 最近成交：时间/数量 排序 + 筛选 + 更多排序。
class _TradeTab extends StatelessWidget {
  const _TradeTab({required this.items, required this.empty});
  final List<WhaleRecentTrade> items;
  final String empty;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return _SortableTab<WhaleRecentTrade>(
      tabId: 'trade',
      items: items,
      empty: empty,
      symOf: (WhaleRecentTrade t) => t.sym,
      leftKeys: <_SortKey<WhaleRecentTrade>>[
        _SortKey<WhaleRecentTrade>('time', l10n.whaleProfileColTime),
        _SortKey<WhaleRecentTrade>(
          'qty',
          l10n.whaleProfileColQty,
          numOf: (t) => whaleSortNum(t.qtyDisplay),
        ),
      ],
      rightKeys: const <_SortKey<WhaleRecentTrade>>[],
      moreSortKeys: <_SortKey<WhaleRecentTrade>>[
        _SortKey<WhaleRecentTrade>(
          'price',
          l10n.whaleProfileColPrice,
          numOf: (t) => whaleSortNum(t.priceDisplay),
        ),
        _SortKey<WhaleRecentTrade>(
          'pnl',
          l10n.whaleProfileColClosedPnl,
          numOf: (t) => t.pnlN,
        ),
        _SortKey<WhaleRecentTrade>(
          'fee',
          l10n.whaleProfileColFee,
          numOf: (t) => whaleSortNum(t.feeDisplay),
        ),
        _SortKey<WhaleRecentTrade>(
          'start',
          l10n.whaleProfileColStart,
          numOf: (t) => whaleSortNum(t.startDisplay),
        ),
      ],
      rowBuilder: (WhaleRecentTrade t) => WhaleTradeRow(t: t),
    );
  }
}

/// 历史委托：时间/数量 排序 + 价格 排序 + 筛选。
class _HistTab extends StatelessWidget {
  const _HistTab({required this.items, required this.empty});
  final List<WhaleHistOrder> items;
  final String empty;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return _SortableTab<WhaleHistOrder>(
      tabId: 'hist',
      items: items,
      empty: empty,
      symOf: (WhaleHistOrder o) => o.sym,
      leftKeys: <_SortKey<WhaleHistOrder>>[
        _SortKey<WhaleHistOrder>('time', l10n.whaleProfileColTime),
        _SortKey<WhaleHistOrder>(
          'qty',
          l10n.whaleProfileColQty,
          numOf: (o) => whaleSortNum(o.qtyDisplay),
        ),
      ],
      rightKeys: <_SortKey<WhaleHistOrder>>[
        _SortKey<WhaleHistOrder>(
          'price',
          l10n.whaleProfileColPrice,
          right: true,
          numOf: (o) => whaleSortNum(o.priceDisplay),
        ),
      ],
      rowBuilder: (WhaleHistOrder o) => WhaleHistRow(o: o),
    );
  }
}
