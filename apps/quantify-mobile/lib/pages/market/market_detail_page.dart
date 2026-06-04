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

/// 交易详情底部固定双按钮 bar。
///
/// 用 `bottomNavigationBar` 而非 `Positioned`：自动处理键盘 inset、SafeArea
/// 与 Scaffold body 内容剪裁，比手工 stack 更稳。
class _OrderActionBar extends StatelessWidget {
  const _OrderActionBar({required this.onBuy, required this.onSell});

  final VoidCallback onBuy;
  final VoidCallback onSell;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg,
          QzSpacing.sm,
          QzSpacing.lg,
          QzSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: c.bgElev,
          border: Border(top: BorderSide(color: c.borderSoft)),
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: _ActionButton(
                key: const Key('market-detail-buy'),
                label: l10n.marketDetailBuyButton,
                subLabel: l10n.marketDetailBuySubLabel,
                color: c.marketUp,
                onPressed: onBuy,
              ),
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: _ActionButton(
                key: const Key('market-detail-sell'),
                label: l10n.marketDetailSellButton,
                subLabel: l10n.marketDetailSellSubLabel,
                color: c.marketDown,
                onPressed: onSell,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    super.key,
    required this.label,
    required this.subLabel,
    required this.color,
    required this.onPressed,
  });

  final String label;
  final String subLabel;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    // 两行布局对齐设计稿 m-screens-3 sticky buy/sell：主文案 + 副文案
    // （「开多 · 10x」/「开空 · 10x」）。高度从 44 提到 46 对齐设计稿
    // height:46，避免 14+10 双行字号挤压。
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(QzRadii.input),
        child: Container(
          height: 46,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(QzRadii.input),
          ),
          alignment: Alignment.center,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subLabel,
                style: const TextStyle(
                  color: Color(0xD9FFFFFF),
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  height: 1.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 行情详情「更多」底部菜单（#1755）。
///
/// 「复制交易对」「切换交易所」为可用项（后者跳转数据来源抽屉，#2099）；
/// 分享 / 提醒标注「即将上线」并禁用点击，避免空回调造成已实现错觉。
class _MoreActionsSheet extends StatelessWidget {
  const _MoreActionsSheet({
    required this.symbol,
    required this.onCopySymbol,
    required this.onSwitchSource,
  });

  final String symbol;
  final Future<void> Function() onCopySymbol;
  final Future<void> Function() onSwitchSource;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            0,
            QzSpacing.lg,
            QzSpacing.sm,
          ),
          child: Text(
            l10n.marketDetailMoreSheetTitle,
            style: TextStyle(
              color: c.textMid,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        _MoreActionTile(
          key: const Key('market-more-copy-symbol'),
          icon: Icons.copy_rounded,
          label: l10n.marketDetailMoreCopySymbol,
          onTap: () {
            Navigator.of(context).pop();
            unawaited(onCopySymbol());
          },
        ),
        _MoreActionTile(
          key: const Key('market-more-share'),
          icon: Icons.ios_share_rounded,
          label: l10n.marketDetailMoreShare,
          disabledNote: l10n.marketDetailMoreComingSoon,
        ),
        _MoreActionTile(
          key: const Key('market-more-alert'),
          icon: Icons.notifications_none_rounded,
          label: l10n.marketDetailMoreAlert,
          disabledNote: l10n.marketDetailMoreComingSoon,
        ),
        _MoreActionTile(
          key: const Key('market-more-switch-exchange'),
          icon: Icons.swap_horiz_rounded,
          label: l10n.marketDetailMoreSwitchExchange,
          onTap: () {
            Navigator.of(context).pop();
            unawaited(onSwitchSource());
          },
        ),
      ],
    );
  }
}

class _MoreActionTile extends StatelessWidget {
  const _MoreActionTile({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
    this.disabledNote,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  /// 非 null 时该项禁用，并在右侧展示该提示文案。
  final String? disabledNote;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool enabled = disabledNote == null;
    final Color fg = enabled ? c.text : c.textDim;
    return ListTile(
      enabled: enabled,
      leading: Icon(icon, size: 20, color: fg),
      title: Text(
        label,
        style: TextStyle(color: fg, fontSize: 14, fontWeight: FontWeight.w500),
      ),
      trailing: disabledNote == null
          ? null
          : Text(
              disabledNote!,
              style: TextStyle(color: c.textDim, fontSize: 12),
            ),
      onTap: onTap,
    );
  }
}

/// K 线下方 flat 4 格累计统计行（#2101）：累计成交额 / 累计净流入 / 最高 / 最低。
///
/// `累计成交额`/`累计净流入` 暂无真实接口：成交额用 `volume24h * price` 估算；
/// 净流入用 `成交额 * changePercent/100` 作占位（涨则净流入为正、跌为负），仅用于
/// 视觉对齐设计稿 m-screens-3。高/低沿用 `MarketDetailStats` 同款 mock 推算
/// （`price * (1 ± |changePct|/100)`），保证两处展示一致。
///
/// TODO(follow-up)：接入真实 24H 聚合接口（turnover / net-inflow / high / low）
/// 后移除本 widget 内估算逻辑，直接读字段。
class _CumulativeStatsRow extends StatelessWidget {
  const _CumulativeStatsRow({required this.ticker});

  final Ticker ticker;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);

    final double absPct = ticker.changePercent.abs() / 100;
    final double high = ticker.price * (1 + absPct);
    final double low = math.max(0, ticker.price * (1 - absPct));
    final double turnover = ticker.volume24h * ticker.price;
    final double netInflow = turnover * ticker.changePercent / 100;
    final bool inflowDown = netInflow < 0;

    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(
          top: BorderSide(color: c.bg, width: 6),
          bottom: BorderSide(color: c.borderSoft),
        ),
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: QzSpacing.md,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _CumStatCell(
            label: l10n.marketDetailCumTurnover,
            value: _fmtCompact(turnover),
          ),
          _CumStatCell(
            label: l10n.marketDetailCumNetInflow,
            value: _fmtSignedCompact(netInflow),
            valueColor: inflowDown ? c.marketDown : c.marketUp,
          ),
          _CumStatCell(
            label: l10n.marketDetailCumHigh,
            value: high.toStringAsFixed(2),
          ),
          _CumStatCell(
            label: l10n.marketDetailCumLow,
            value: low.toStringAsFixed(2),
          ),
        ],
      ),
    );
  }

  static String _fmtCompact(double v) {
    final double abs = v.abs();
    if (abs >= 1e9) return '${(v / 1e9).toStringAsFixed(2)}B';
    if (abs >= 1e6) return '${(v / 1e6).toStringAsFixed(2)}M';
    if (abs >= 1e3) return '${(v / 1e3).toStringAsFixed(2)}K';
    return v.toStringAsFixed(2);
  }

  static String _fmtSignedCompact(double v) {
    final String sign = v < 0 ? '-' : '+';
    return '$sign${_fmtCompact(v.abs())}';
  }
}

class _CumStatCell extends StatelessWidget {
  const _CumStatCell({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: c.textDim, fontSize: 10.5),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: valueColor ?? c.text,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ],
      ),
    );
  }
}
