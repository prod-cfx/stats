import 'package:flutter/material.dart';

import '../../../data/mock/fixtures/trades.dart';
import '../../../data/models/trade_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 成交记录面板（#1563）。
///
/// mock 阶段直接生成 36 行，真实接入后由 `tradeRepository.watchTrades`
/// 推流并维护一个有界 ring buffer。本 widget 是无状态展示层，便于测试。
///
/// 列表头单位由 `symbol` 解析为 `baseAsset` / `quoteAsset` 后动态拼接，
/// 兼容 ETH/USDT、SOL/USDT 等非 BTC 交易对。
class TradesPanel extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<Trade> rows =
        trades ?? buildMockTrades(symbol: symbol, mid: mid);
    final (String base, String quote) = splitSymbolAssets(symbol);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
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
        // TODO(real-api): 接 `tradeRepository.watchTrades` 后改成有界 SliverList，
        // 当前 mock 36 行用 shrinkWrap+NeverScrollable 嵌在 Column 里没问题。
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
