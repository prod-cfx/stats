import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/market_source.dart';
import '../../data/models/ticker_models.dart';
import '../../data/models/trade_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_empty_state.dart';
import 'widgets/qz_kline_chart.dart';
import '../../widgets/qz_sheet.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_top_bar.dart';
import 'widgets/qz_trade_order_sheet.dart';
import 'market_detail_controller.dart';
import 'market_detail_state.dart';
import 'widgets/depth_panel.dart';
import 'widgets/market_detail_stats.dart';
import 'widgets/orderbook_view.dart';
import 'widgets/source_picker.dart';
import 'widgets/trades_panel.dart';
part 'market_detail_page.panel.part.dart';
part 'market_detail_page.actions.part.dart';

/// 行情详情页。页面级状态（interval/source/snapshot/candles/panel/双流/竞态）
/// 由 [MarketDetailController]（按 symbol family）持有（issue #2184）。
class MarketDetailPage extends ConsumerWidget {
  const MarketDetailPage({super.key, required this.symbol});

  final String symbol;

  Future<void> _openOrderSheet(
    BuildContext context,
    WidgetRef ref,
    TradeDirection direction,
  ) async {
    final MarketDetailState s = ref.read(marketDetailControllerProvider(symbol));
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    final AppLocalizations l10n = AppLocalizations.of(context);
    final TradeOrderResult? result = await QzTradeOrderSheet.show(
      context,
      symbol: symbol,
      direction: direction,
      markPrice: s.priceSnapshot?.price,
    );
    if (result == null) return;
    messenger.showSnackBar(
      SnackBar(
        content: Text(l10n.tradeOrderSheetSuccessToast),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _toggleFavorite(BuildContext context, WidgetRef ref) async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    final bool wasFavorite =
        ref.read(marketFavoritesProvider).contains(symbol);
    try {
      await ref.read(marketFavoritesProvider.notifier).toggle(symbol);
    } catch (_) {
      // 写盘失败由 notifier 回滚 state；不弹成功 toast。
      return;
    }
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          wasFavorite
              ? l10n.marketDetailFavoriteRemovedToast
              : l10n.marketDetailFavoriteAddedToast,
        ),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _openMoreSheet(BuildContext context, WidgetRef ref) async {
    await QzSheet.show<void>(
      context: context,
      useRootNavigator: true,
      builder: (BuildContext sheetCtx) => _MoreActionsSheet(
        symbol: symbol,
        onCopySymbol: () => _copySymbol(context),
        onSwitchSource: () => _openSourceSheet(context, ref),
      ),
    );
  }

  /// 「更多」中「切换交易所」入口：复用 [DataSourceSheet] 单选数据来源。
  Future<void> _openSourceSheet(BuildContext context, WidgetRef ref) async {
    final MarketSource current =
        ref.read(marketDetailControllerProvider(symbol)).source;
    final MarketSource? next = await QzSheet.show<MarketSource>(
      context: context,
      useRootNavigator: true,
      builder: (BuildContext ctx) => DataSourceSheet(current: current),
    );
    if (next == null) return;
    ref
        .read(marketDetailControllerProvider(symbol).notifier)
        .changeSource(next);
  }

  Future<void> _copySymbol(BuildContext context) async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    await Clipboard.setData(ClipboardData(text: symbol));
    messenger.showSnackBar(
      SnackBar(
        content: Text(l10n.marketDetailMoreCopiedToast),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10nForBar = AppLocalizations.of(context);
    final MarketDetailState s =
        ref.watch(marketDetailControllerProvider(symbol));
    final MarketDetailController controller =
        ref.read(marketDetailControllerProvider(symbol).notifier);
    final bool isFavorite =
        ref.watch(marketFavoritesProvider).contains(symbol);
    return Scaffold(
      appBar: QzTopBar(
        title: _topBarTitle(symbol),
        subtitle: s.source.isAggregated
            ? l10nForBar.marketDetailSubtitlePerpAggregated
            : l10nForBar.marketDetailSubtitlePerpExchange(
                s.source.exchangeName!,
              ),
        onBack: () => context.pop(),
        actions: <Widget>[
          IconButton(
            key: const Key('market-detail-favorite'),
            icon: Icon(
              isFavorite ? Icons.star : Icons.star_border,
              size: 20,
              color: isFavorite ? context.qzScheme.statusWarn : null,
            ),
            onPressed: () => unawaited(_toggleFavorite(context, ref)),
            tooltip: l10nForBar.marketDetailStarTooltip,
          ),
          IconButton(
            key: const Key('market-detail-more'),
            icon: const Icon(Icons.more_horiz, size: 20),
            onPressed: () => unawaited(_openMoreSheet(context, ref)),
            tooltip: l10nForBar.marketDetailMoreTooltip,
          ),
        ],
      ),
      bottomNavigationBar: s.priceSnapshot == null
          ? null
          : _OrderActionBar(
              onBuy: () => _openOrderSheet(context, ref, TradeDirection.buy),
              onSell: () => _openOrderSheet(context, ref, TradeDirection.sell),
            ),
      body: Builder(
        builder: (BuildContext context) {
          final AppLocalizations l10n = AppLocalizations.of(context);
          if (s.loading) return const Center(child: QzSpinner());
          if (s.error != null) {
            return QzEmptyState(
              title: '$symbol ${l10n.commonLoadError}',
            );
          }
          if (s.priceSnapshot == null) {
            return QzEmptyState(
              title: symbol,
              subtitle: l10n.marketDetailSymbolNotFound,
            );
          }
          return SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                _MarketChartSection(
                  stats: MarketDetailStats(
                    displaySymbol: symbol,
                    ticker: s.priceSnapshot!,
                  ),
                  chart: QzKlineChart(
                    candles: s.candles,
                    interval: s.interval,
                    trailing: SourcePicker(
                      source: s.source,
                      onChanged: controller.changeSource,
                    ),
                    hasError: s.klineError,
                    onRetry: s.klineError ? controller.retryKline : null,
                    onIntervalChanged: controller.changeInterval,
                  ),
                ),
                _CumulativeStatsRow(ticker: s.priceSnapshot!),
                _PanelSection(
                  tabBar: _PanelTabBar(
                    panel: s.panel,
                    onChanged: controller.changePanel,
                  ),
                  body: _PanelBody(
                    panel: s.panel,
                    symbol: symbol,
                    mid: s.priceSnapshot!.price,
                    changePercent: s.priceSnapshot!.changePercent,
                    trades: s.trades ?? const <Trade>[],
                  ),
                ),
                const SizedBox(height: QzSpacing.md),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// TopBar 标题格式化：`BTCUSDT` → `BTC / USDT`（对齐设计稿 m-screens-3）。
///
/// 用 `splitSymbolAssets` 解析 base/quote；无法解析（quote 为空）时回退展示
/// 原 symbol，避免非标准交易对崩溃或出现孤立分隔符。
String _topBarTitle(String symbol) {
  final (String base, String quote) = splitSymbolAssets(symbol);
  if (quote.isEmpty) return symbol;
  return '$base / $quote';
}

