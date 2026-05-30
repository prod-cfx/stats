import 'package:flutter/material.dart';

import '../../../data/mock/fixtures/agg_orders.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 币种搜索全屏 overlay（设计稿 `CoinFilterChips` 的搜索按钮 → `SearchOverlay`）。
///
/// 顶部输入框实时过滤 [coins]；空查询时显示「热门币种」全量。点选返回币种，
/// 由调用方 [showAggCoinSearch] 以 `Navigator.pop` 透传。
Future<String?> showAggCoinSearch(
  BuildContext context, {
  required List<String> coins,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (BuildContext ctx) => _AggCoinSearchSheet(coins: coins),
  );
}

class _AggCoinSearchSheet extends StatefulWidget {
  const _AggCoinSearchSheet({required this.coins});

  final List<String> coins;

  @override
  State<_AggCoinSearchSheet> createState() => _AggCoinSearchSheetState();
}

class _AggCoinSearchSheetState extends State<_AggCoinSearchSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String q = _query.trim().toLowerCase();
    final List<String> results = q.isEmpty
        ? widget.coins
        : widget.coins
            .where((String s) => s.toLowerCase().contains(q))
            .toList();

    return FractionallySizedBox(
      heightFactor: 0.9,
      child: Material(
        color: c.bgElev,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(context).viewInsets.bottom,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    QzSpacing.lg,
                    QzSpacing.md,
                    QzSpacing.sm,
                    QzSpacing.sm,
                  ),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: TextField(
                          key: const Key('agg-coin-search-field'),
                          autofocus: true,
                          onChanged: (String v) => setState(() => _query = v),
                          style: TextStyle(color: c.text, fontSize: 14),
                          decoration: InputDecoration(
                            isDense: true,
                            prefixIcon:
                                Icon(Icons.search, size: 18, color: c.textDim),
                            hintText: l10n.aggCoinSearchHint,
                            hintStyle:
                                TextStyle(color: c.textDim, fontSize: 14),
                            filled: true,
                            fillColor: c.bgSoft,
                            contentPadding: const EdgeInsets.symmetric(
                              vertical: QzSpacing.sm,
                            ),
                            border: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(QzRadii.input),
                              borderSide: BorderSide(color: c.borderSoft),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius:
                                  BorderRadius.circular(QzRadii.input),
                              borderSide: BorderSide(color: c.borderSoft),
                            ),
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: Text(
                          l10n.aggCancel,
                          style: TextStyle(color: c.textMid),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    QzSpacing.lg,
                    0,
                    QzSpacing.lg,
                    QzSpacing.xs,
                  ),
                  child: Text(
                    q.isEmpty ? l10n.aggCoinSearchHot : '',
                    style: TextStyle(color: c.textDim, fontSize: 12),
                  ),
                ),
                Expanded(
                  child: results.isEmpty
                      ? Center(
                          child: Text(
                            l10n.aggCoinSearchEmpty,
                            style: TextStyle(color: c.textDim, fontSize: 13),
                          ),
                        )
                      : ListView.builder(
                          itemCount: results.length,
                          itemBuilder: (BuildContext ctx, int i) {
                            final String coin = results[i];
                            final Color dot =
                                kAggCoinColor[coin] ?? c.accent;
                            return ListTile(
                              key: Key('agg-coin-result-$coin'),
                              leading: CircleAvatar(
                                radius: 14,
                                backgroundColor: dot,
                                child: Text(
                                  coin.substring(0, 1),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              title: Text(
                                coin,
                                style: TextStyle(
                                  color: c.text,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              subtitle: Text(
                                '/ USDT',
                                style:
                                    TextStyle(color: c.textDim, fontSize: 11),
                              ),
                              onTap: () => Navigator.of(context).pop(coin),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
