import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/kline_models.dart';
import '../../data/models/long_short_models.dart';
import '../../data/models/ticker_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_kline_chart.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_stat_chip.dart';
import '../../widgets/qz_top_bar.dart';
import '../../widgets/qz_trade_order_sheet.dart';
import 'widgets/long_short_bar.dart';
import 'widgets/orderbook_view.dart';

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
    return Scaffold(
      appBar: QzTopBar(title: widget.symbol, onBack: () => context.pop()),
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
            padding: const EdgeInsets.all(QzSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                _PriceCard(
                  displaySymbol: widget.symbol,
                  ticker: _priceSnapshot!,
                ),
                const SizedBox(height: QzSpacing.md),
                QzKlineChart(
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
                const SizedBox(height: QzSpacing.md),
                QzCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      _SectionTitle(l10n.marketDetailSectionOrderbook),
                      const SizedBox(height: QzSpacing.md),
                      OrderbookView(symbol: widget.symbol),
                    ],
                  ),
                ),
                const SizedBox(height: QzSpacing.md),
                QzCard(
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
              ],
            ),
          );
        },
      ),
    );
  }
}

class _PriceCard extends StatelessWidget {
  const _PriceCard({required this.displaySymbol, required this.ticker});

  final String displaySymbol;
  final Ticker ticker;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  '${l10n.marketDetailTickerPrefix}$displaySymbol',
                  style: TextStyle(color: c.textDim, fontSize: 12),
                ),
                const SizedBox(height: 6),
                Text(
                  ticker.price.toStringAsFixed(2),
                  style: TextStyle(
                    color: c.text,
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ],
            ),
          ),
          QzStatChip(value: ticker.changePercent / 100),
        ],
      ),
    );
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
                color: c.marketUp,
                onPressed: onBuy,
              ),
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: _ActionButton(
                key: const Key('market-detail-sell'),
                label: l10n.marketDetailSellButton,
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
    required this.color,
    required this.onPressed,
  });

  final String label;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(QzRadii.input),
        child: Container(
          height: 44,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(QzRadii.input),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
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

