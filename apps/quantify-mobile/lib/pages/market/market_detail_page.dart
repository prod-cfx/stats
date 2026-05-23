import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/kline_models.dart';
import '../../data/models/long_short_models.dart';
import '../../data/models/ticker_models.dart';
import '../../data/models/trade_models.dart';
import '../../data/mock/fixtures/trades.dart' as trade_fixtures;
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_kline_chart.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_top_bar.dart';
import '../../widgets/qz_trade_order_sheet.dart';
import 'widgets/depth_panel.dart';
import 'widgets/long_short_bar.dart';
import 'widgets/market_detail_stats.dart';
import 'widgets/orderbook_view.dart';
import 'widgets/trades_panel.dart';

/// Panel 选项：盘口 / 成交 / 深度图（#1563）。
enum _DetailPanel { book, trades, depth }

class MarketDetailPage extends ConsumerStatefulWidget {
  const MarketDetailPage({super.key, required this.symbol});

  final String symbol;

  @override
  ConsumerState<MarketDetailPage> createState() => _MarketDetailPageState();
}

class _MarketDetailPageState extends ConsumerState<MarketDetailPage> {
  static const int _klineHistoryLimit = 200;

  KlineInterval _interval = KlineInterval.h1;
  Ticker? _priceSnapshot;
  LongShortRatio? _longShort;
  List<Candle> _candles = const <Candle>[];
  bool _klineError = false;
  _DetailPanel _panel = _DetailPanel.book;
  // Mock 阶段 trade 列表生成一次后缓存，避免 panel 切换或 ticker 推流时
  // 父 widget rebuild 让 TradesPanel 重新构造 36 条 mock。真实接入后由
  // tradeRepository 推流维护 ring buffer，本字段会被替换为 StreamSubscription。
  List<Trade>? _trades;
  StreamSubscription<Ticker>? _tickerSub;
  StreamSubscription<Candle>? _candleSub;
  bool _loading = true;
  Object? _error;
  int _longShortRequestId = 0;
  int _klineRequestId = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final tickerRepo = ref.read(tickerRepositoryProvider);
    try {
      final List<Ticker> tickers = await tickerRepo.listTickers();
      Ticker? snapshot;
      for (final Ticker ticker in tickers) {
        if (ticker.symbol == widget.symbol) {
          snapshot = ticker;
          break;
        }
      }
      if (snapshot == null) {
        if (!mounted) return;
        setState(() {
          _priceSnapshot = null;
          _longShort = null;
          _loading = false;
        });
        return;
      }
      if (!mounted) return;
      setState(() {
        _priceSnapshot = snapshot;
        _loading = false;
      });
      _tickerSub = tickerRepo.watchTicker(widget.symbol).listen((Ticker next) {
        if (!mounted) return;
        setState(() => _priceSnapshot = next);
      });
      // 复用 _loadLongShort / _loadKline，避免与各自 requestId 守卫脱节。
      unawaited(_loadLongShort());
      unawaited(_loadKline(_interval));
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  /// 拉取指定周期历史 K 线并重新订阅推流。
  ///
  /// `_klineRequestId` 用于丢弃旧请求：若用户快速切换周期，先发的请求回调
  /// 时已与当前 `_interval` 不一致，直接抛弃避免错乱 setState。
  Future<void> _loadKline(KlineInterval interval) async {
    final int requestId = ++_klineRequestId;
    // 在第一个 await 之前同步读取 provider，避免页面在 await 期间销毁后
    // 再访问 ref（ConsumerState 在 dispose 后 ref.read 会抛 StateError）。
    final klineRepo = ref.read(klineRepositoryProvider);
    // 先解除旧订阅引用，再 await 取消；先置 null 可避免并发 _loadKline
    // 中两次看到相同 subscription 并各自 cancel 的窗口（Dart 幂等，但语义更清晰）。
    final StreamSubscription<Candle>? oldSub = _candleSub;
    _candleSub = null;
    await oldSub?.cancel();
    try {
      final List<Candle> history = await klineRepo.listCandles(
        symbol: widget.symbol,
        interval: interval,
        limit: _klineHistoryLimit,
      );
      if (!mounted || requestId != _klineRequestId) return;
      setState(() {
        _candles = history;
        _klineError = false;
      });
      _candleSub = klineRepo
          .watchCandles(symbol: widget.symbol, interval: interval)
          .listen((Candle next) {
        if (!mounted || requestId != _klineRequestId) return;
        // 当前阶段：append-only。同 openTime upsert 留待真实 WS 接入时补。
        setState(() => _candles = <Candle>[..._candles, next]);
      });
    } catch (_) {
      if (!mounted || requestId != _klineRequestId) return;
      setState(() {
        _candles = const <Candle>[];
        _klineError = true;
      });
    }
  }

  Future<void> _loadLongShort() async {
    final int requestId = ++_longShortRequestId;
    // 同步读取 provider，避免 await 后 ref 失效。
    final longShortRepo = ref.read(longShortRepositoryProvider);
    final KlineInterval interval = _interval;
    try {
      final LongShortRatio ratio = await longShortRepo.getRatio(
        symbol: widget.symbol,
        interval: interval,
      );
      if (!mounted || requestId != _longShortRequestId) return;
      setState(() => _longShort = ratio);
    } catch (_) {
      if (!mounted || requestId != _longShortRequestId) return;
      setState(() => _longShort = null);
    }
  }

  @override
  void dispose() {
    unawaited(_tickerSub?.cancel());
    unawaited(_candleSub?.cancel());
    super.dispose();
  }

  Future<void> _openOrderSheet(TradeDirection direction) async {
    final TradeOrderResult? result = await QzTradeOrderSheet.show(
      context,
      symbol: widget.symbol,
      direction: direction,
      markPrice: _priceSnapshot?.price,
    );
    if (!mounted || result == null) return;
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    final AppLocalizations l10n = AppLocalizations.of(context);
    messenger.showSnackBar(
      SnackBar(
        content: Text(l10n.tradeOrderSheetSuccessToast),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10nForBar = AppLocalizations.of(context);
    return Scaffold(
      appBar: QzTopBar(
        title: widget.symbol,
        subtitle: l10nForBar.marketDetailSubtitlePerpBinance,
        onBack: () => context.pop(),
        actions: <Widget>[
          IconButton(
            icon: const Icon(Icons.star_border, size: 20),
            onPressed: () {},
            tooltip: l10nForBar.marketDetailStarTooltip,
          ),
          IconButton(
            icon: const Icon(Icons.more_horiz, size: 20),
            onPressed: () {},
            tooltip: l10nForBar.marketDetailMoreTooltip,
          ),
        ],
      ),
      bottomNavigationBar: _priceSnapshot == null
          ? null
          : _OrderActionBar(
              onBuy: () => _openOrderSheet(TradeDirection.buy),
              onSell: () => _openOrderSheet(TradeDirection.sell),
            ),
      body: Builder(
        builder: (BuildContext context) {
          final AppLocalizations l10n = AppLocalizations.of(context);
          if (_loading) return const Center(child: QzSpinner());
          if (_error != null) {
            return QzEmptyState(title: '${widget.symbol} ${l10n.commonLoadError}');
          }
          if (_priceSnapshot == null) {
            return QzEmptyState(
              title: widget.symbol,
              subtitle: l10n.marketDetailSymbolNotFound,
            );
          }
          return SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                MarketDetailStats(
                  displaySymbol: widget.symbol,
                  ticker: _priceSnapshot!,
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: QzSpacing.lg,
                  ),
                  child: QzKlineChart(
                    candles: _candles,
                    interval: _interval,
                    hasError: _klineError,
                    onRetry: _klineError
                        ? () {
                            setState(() => _klineError = false);
                            unawaited(_loadKline(_interval));
                          }
                        : null,
                    onIntervalChanged: (KlineInterval next) {
                      if (next == _interval) return;
                      setState(() {
                        _interval = next;
                        _candles = const <Candle>[];
                        _klineError = false;
                      });
                      unawaited(_loadKline(next));
                      unawaited(_loadLongShort());
                    },
                  ),
                ),
                const SizedBox(height: QzSpacing.md),
                _PanelTabBar(
                  panel: _panel,
                  onChanged: (_DetailPanel next) {
                    if (next == _panel) return;
                    setState(() => _panel = next);
                  },
                ),
                _PanelBody(
                  panel: _panel,
                  symbol: widget.symbol,
                  mid: _priceSnapshot!.price,
                  trades: _trades ??= trade_fixtures.buildMockTrades(
                    symbol: widget.symbol,
                    mid: _priceSnapshot!.price,
                  ),
                ),
                const SizedBox(height: QzSpacing.md),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: QzSpacing.lg,
                  ),
                  child: QzCard(
                    onTap: () => context.push('/market/long-short'),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        _SectionTitle(l10n.marketLongShortTitle),
                        const SizedBox(height: QzSpacing.md),
                        if (_longShort == null)
                          QzEmptyState(title: l10n.marketLongShortLoadError)
                        else
                          LongShortBar(
                            longRatio: _longShort!.longRatio,
                            shortRatio: _longShort!.shortRatio,
                          ),
                      ],
                    ),
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

/// 3 段 underline panel tab：盘口 / 成交 / 深度图（#1563）。
class _PanelTabBar extends StatelessWidget {
  const _PanelTabBar({required this.panel, required this.onChanged});

  final _DetailPanel panel;
  final ValueChanged<_DetailPanel> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<(_DetailPanel, String)> items = <(_DetailPanel, String)>[
      (_DetailPanel.book, l10n.marketDetailPanelOrderbook),
      (_DetailPanel.trades, l10n.marketDetailPanelTrades),
      (_DetailPanel.depth, l10n.marketDetailPanelDepth),
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
          for (final (_DetailPanel key, String label) in items)
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
    required this.trades,
  });

  final _DetailPanel panel;
  final String symbol;
  final double mid;
  final List<Trade> trades;

  @override
  Widget build(BuildContext context) {
    switch (panel) {
      case _DetailPanel.book:
        return Padding(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            QzSpacing.md,
            QzSpacing.lg,
            0,
          ),
          child: OrderbookView(symbol: symbol),
        );
      case _DetailPanel.trades:
        return TradesPanel(symbol: symbol, mid: mid, trades: trades);
      case _DetailPanel.depth:
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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Text(
      text,
      style: TextStyle(
        color: c.textMid,
        fontSize: 14,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

