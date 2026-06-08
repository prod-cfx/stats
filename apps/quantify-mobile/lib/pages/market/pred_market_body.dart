import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/pred_market_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import 'pred_market_body_controller.dart';
import 'pred_market_body_state.dart';
import 'widgets/pred_market_card.dart';
import 'widgets/pred_market_detail_sheet.dart';
import 'widgets/pred_market_search_overlay.dart';

/// 预测市场 hub 子屏（设计稿 `ScreenPredMarket`:1622）。
///
/// 副标题 + 可点搜索栏（弹全屏 [PredMarketSearchOverlay]）+ 2 列卡片网格 +
/// 搜索空态。无 Scaffold / header（由 [DataHubPage] 提供）。点击卡片弹
/// [PredMarketDetailSheet]。页面级搜索词由 [PredMarketController] 持有（#2184）。
class PredMarketBody extends ConsumerWidget {
  const PredMarketBody({super.key, this.markets});

  /// 数据源覆盖（测试可注入）。为 null 时经 locale family provider 取数。
  final List<PredMarket>? markets;

  /// 解析数据源：优先注入值，否则按 locale 取数（加载/错误态
  /// 回退空列表）。`build` 用 watch；回调内用 read。
  List<PredMarket> _read(WidgetRef ref, String locale) {
    return markets ??
        ref.read(predMarketsByLocaleProvider(locale)).value ??
        const <PredMarket>[];
  }

  List<PredMarket> _shown(List<PredMarket> markets, String filter) {
    final String q = filter.trim().toLowerCase();
    if (q.isEmpty) return markets;
    return markets
        .where((PredMarket m) => m.question.toLowerCase().contains(q))
        .toList(growable: false);
  }

  Future<void> _openSearch(BuildContext context, WidgetRef ref) async {
    final String locale = _polymarketLocale(context);
    await Navigator.of(context, rootNavigator: true).push<void>(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => PredMarketSearchOverlay(
          markets: _read(ref, locale),
          onApplyQuery: (String q) =>
              ref.read(predMarketControllerProvider.notifier).setFilter(q),
          onOpenMarket: (PredMarket m) => _openDetail(context, m),
        ),
      ),
    );
  }

  void _openDetail(BuildContext context, PredMarket m) {
    PredMarketDetailSheet.show(context, m);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String filter = ref.watch(
      predMarketControllerProvider.select((PredMarketState s) => s.filter),
    );
    final String locale = _polymarketLocale(context);
    final List<PredMarket> markets =
        this.markets ??
        ref.watch(predMarketsByLocaleProvider(locale)).value ??
        const <PredMarket>[];
    final List<PredMarket> shown = _shown(markets, filter);
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
            child: _searchBar(context, ref, c, l10n, filter),
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
                            padding: const EdgeInsets.fromLTRB(12, 0, 12, 100),
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
                                        onTap: () => _openDetail(context, m),
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

  Widget _searchBar(
    BuildContext context,
    WidgetRef ref,
    QzColorScheme c,
    AppLocalizations l10n,
    String filter,
  ) {
    return GestureDetector(
      key: const Key('pred-search-bar'),
      onTap: () => _openSearch(context, ref),
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
                filter.isEmpty ? l10n.predMarketSearchHint : filter,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: filter.isEmpty ? c.textDim : c.text,
                  fontSize: 13,
                ),
              ),
            ),
            if (filter.isNotEmpty)
              GestureDetector(
                key: const Key('pred-search-bar-clear'),
                onTap: () => ref
                    .read(predMarketControllerProvider.notifier)
                    .setFilter(''),
                child: Icon(Icons.cancel, size: 16, color: c.textDim),
              ),
          ],
        ),
      ),
    );
  }

  String _polymarketLocale(BuildContext context) {
    final String code = Localizations.localeOf(context).languageCode;
    return code.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }
}
