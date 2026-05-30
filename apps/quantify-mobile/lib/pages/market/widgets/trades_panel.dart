import 'package:flutter/material.dart';

import '../../../data/mock/fixtures/trades.dart';
import '../../../data/models/trade_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 成交面板子标签（设计稿 `m-screens-3.jsx:631-668`）。
enum TradesTab { latest, big }

/// 大额成交过滤阈值（base 资产数量）。mock qty 区间 0.01–0.51，0.3 能稳定切出
/// 一个明显更短的子集，便于交互与测试。真实接入后由后端按成交额阈值给出。
const double kBigTradeQtyThreshold = 0.3;

/// 过滤大额成交。纯函数，便于单测。
List<Trade> filterBigTrades(List<Trade> trades) =>
    trades.where((Trade t) => t.qty >= kBigTradeQtyThreshold).toList();

/// 按时间倒序（默认）或数量降序排序。纯函数，便于单测。
List<Trade> sortTrades(List<Trade> trades, {required bool byQty}) {
  final List<Trade> out = <Trade>[...trades];
  out.sort((Trade a, Trade b) => byQty
      ? b.qty.compareTo(a.qty)
      : b.time.compareTo(a.time));
  return out;
}

/// 成交记录面板（#1563 / #1768）。
///
/// mock 阶段直接生成 36 行，真实接入后由 `tradeRepository.watchTrades`
/// 推流并维护一个有界 ring buffer。
///
/// 子标签（最新/大额）与排序在本 widget 内部状态维护；过滤/排序为纯函数，
/// 真实接入后只换数据源不动交互。列表头单位由 `symbol` 解析为 `baseAsset` /
/// `quoteAsset` 后动态拼接，兼容 ETH/USDT、SOL/USDT 等非 BTC 交易对。
class TradesPanel extends StatefulWidget {
  const TradesPanel({
    super.key,
    required this.symbol,
    required this.mid,
    this.trades,
  });

  final String symbol;
  final double mid;
  final List<Trade>? trades;

  @override
  State<TradesPanel> createState() => _TradesPanelState();
}

class _TradesPanelState extends State<TradesPanel> {
  TradesTab _tab = TradesTab.latest;
  bool _sortByQty = false;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<Trade> source =
        widget.trades ?? buildMockTrades(symbol: widget.symbol, mid: widget.mid);
    final List<Trade> filtered =
        _tab == TradesTab.big ? filterBigTrades(source) : source;
    final List<Trade> rows = sortTrades(filtered, byQty: _sortByQty);
    final (String base, String quote) = splitSymbolAssets(widget.symbol);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _SubTabBar(
          tab: _tab,
          sortByQty: _sortByQty,
          onTabChanged: (TradesTab t) => setState(() => _tab = t),
          onSortToggle: () => setState(() => _sortByQty = !_sortByQty),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            QzSpacing.sm,
            QzSpacing.lg,
            QzSpacing.xs,
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  l10n.marketDetailColTime,
                  style: TextStyle(
                    color: c.textDim,
                    fontSize: 10,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
              Expanded(
                flex: 2,
                child: Text(
                  '${l10n.marketDetailColPrice}($quote)',
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    color: c.textDim,
                    fontSize: 10,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  '${l10n.marketDetailColQty}($base)',
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    color: c.textDim,
                    fontSize: 10,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
            ],
          ),
        ),
        ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: rows.length,
          itemBuilder: (BuildContext _, int i) => _TradeRow(trade: rows[i]),
        ),
      ],
    );
  }
}

class _SubTabBar extends StatelessWidget {
  const _SubTabBar({
    required this.tab,
    required this.sortByQty,
    required this.onTabChanged,
    required this.onSortToggle,
  });

  final TradesTab tab;
  final bool sortByQty;
  final ValueChanged<TradesTab> onTabChanged;
  final VoidCallback onSortToggle;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<(TradesTab, String)> items = <(TradesTab, String)>[
      (TradesTab.latest, l10n.tradesTabLatest),
      (TradesTab.big, l10n.tradesTabBig),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.sm,
        QzSpacing.lg,
        QzSpacing.xs,
      ),
      child: Row(
        children: <Widget>[
          for (final (TradesTab, String) item in items)
            Padding(
              padding: const EdgeInsets.only(right: QzSpacing.sm),
              child: GestureDetector(
                onTap: () => onTabChanged(item.$1),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: QzSpacing.md,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: tab == item.$1 ? c.bgSoft : Colors.transparent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    item.$2,
                    style: TextStyle(
                      color: tab == item.$1 ? c.text : c.textMid,
                      fontSize: 12,
                      fontWeight:
                          tab == item.$1 ? FontWeight.w600 : FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          const Spacer(),
          IconButton(
            tooltip: l10n.tradesSortTooltip,
            icon: const Icon(Icons.swap_vert, size: 16),
            color: sortByQty ? c.accent : c.textMid,
            onPressed: onSortToggle,
          ),
        ],
      ),
    );
  }
}

class _TradeRow extends StatelessWidget {
  const _TradeRow({required this.trade});

  final Trade trade;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color priceColor = trade.isBuy ? c.marketUp : c.marketDown;
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: 6,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              _fmtTime(trade.time),
              style: TextStyle(
                color: c.textMid,
                fontSize: 12,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              trade.price.toStringAsFixed(2),
              textAlign: TextAlign.right,
              style: TextStyle(
                color: priceColor,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ),
          Expanded(
            child: Text(
              trade.qty.toStringAsFixed(4),
              textAlign: TextAlign.right,
              style: TextStyle(
                color: c.text,
                fontSize: 12,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _fmtTime(DateTime t) {
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(t.hour)}:${two(t.minute)}:${two(t.second)}';
  }
}
