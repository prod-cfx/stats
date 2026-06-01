import 'package:flutter/material.dart';

import '../../data/mock/fixtures/pred_markets.dart';
import '../../data/models/pred_market_models.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import 'widgets/pred_market_card.dart';
import 'widgets/pred_market_detail_sheet.dart';
import 'widgets/pred_market_search_overlay.dart';

/// 预测市场 hub 子屏（设计稿 `ScreenPredMarket`:1622）。
///
/// 副标题 + 可点搜索栏（弹全屏 [PredMarketSearchOverlay]）+ 2 列卡片网格 +
/// 搜索空态。无 Scaffold / header（由 [DataHubPage] 提供）。点击卡片弹
/// [PredMarketDetailSheet]。
class PredMarketBody extends StatefulWidget {
  const PredMarketBody({super.key, this.markets = kPredMarkets});

  /// 数据源（默认 mock fixtures，测试可注入）。
  final List<PredMarket> markets;

  @override
  State<PredMarketBody> createState() => _PredMarketBodyState();
}

class _PredMarketBodyState extends State<PredMarketBody> {
  String _filter = '';

  List<PredMarket> get _shown {
    final String q = _filter.trim().toLowerCase();
    if (q.isEmpty) return widget.markets;
    return widget.markets
        .where((PredMarket m) => m.question.toLowerCase().contains(q))
        .toList(growable: false);
  }

  Future<void> _openSearch() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => PredMarketSearchOverlay(
          markets: widget.markets,
          onApplyQuery: (String q) {
            if (mounted) setState(() => _filter = q);
          },
          onOpenMarket: _openDetail,
        ),
      ),
    );
  }

  void _openDetail(PredMarket m) {
    if (!mounted) return;
    PredMarketDetailSheet.show(context, m);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<PredMarket> shown = _shown;
    return ColoredBox(
      color: c.bg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.sm + 2,
              QzSpacing.lg,
              QzSpacing.xxs,
            ),
            child: Text(
              l10n.predMarketSubtitle,
              style: TextStyle(color: c.textDim, fontSize: 11),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.xs,
              QzSpacing.lg,
              QzSpacing.sm,
            ),
            child: _searchBar(c, l10n),
          ),
          Expanded(
            child: shown.isEmpty
                ? Center(
                    key: const Key('pred-empty'),
                    child: Text(
                      l10n.predMarketEmpty,
                      style: TextStyle(color: c.textDim, fontSize: 13),
                    ),
                  )
                : LayoutBuilder(
                    builder:
                        (BuildContext context, BoxConstraints constraints) {
                          const double gap = 8;
                          final double width =
                              (constraints.maxWidth - 24 - gap) / 2;
                          return SingleChildScrollView(
                            key: const Key('pred-grid'),
                            padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                            child: Wrap(
                              spacing: gap,
                              runSpacing: gap,
                              children: <Widget>[
                                for (final PredMarket m in shown)
                                  SizedBox(
                                    width: width,
                                    child: ConstrainedBox(
                                      constraints: const BoxConstraints(
                                        minHeight: 128,
                                      ),
                                      child: PredMarketCard(
                                        market: m,
                                        onTap: () => _openDetail(m),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          );
                        },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _searchBar(QzColorScheme c, AppLocalizations l10n) {
    return GestureDetector(
      key: const Key('pred-search-bar'),
      onTap: _openSearch,
      child: Container(
        height: 38,
        decoration: BoxDecoration(
          color: c.bgInput,
          border: Border.all(color: c.border),
          borderRadius: BorderRadius.circular(999),
        ),
        padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
        child: Row(
          children: <Widget>[
            Icon(Icons.search, size: 16, color: c.textDim),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: Text(
                _filter.isEmpty ? l10n.predMarketSearchHint : _filter,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: _filter.isEmpty ? c.textDim : c.text,
                  fontSize: 13,
                ),
              ),
            ),
            if (_filter.isNotEmpty)
              GestureDetector(
                key: const Key('pred-search-bar-clear'),
                onTap: () => setState(() => _filter = ''),
                child: Icon(Icons.cancel, size: 16, color: c.textDim),
              ),
          ],
        ),
      ),
    );
  }
}
