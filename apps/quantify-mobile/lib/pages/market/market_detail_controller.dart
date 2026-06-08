import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/error/error_router.dart';
import '../../core/providers/notifier_lifecycle.dart';
import '../../data/models/kline_models.dart';
import '../../data/models/market_source.dart';
import '../../data/models/ticker_models.dart';
import '../../data/models/trade_models.dart';
import '../../data/providers.dart';
import 'market_detail_state.dart';

/// 行情详情页控制器（issue #2184）。
///
/// `build(symbol)`（family arg）触发初始加载：拉 ticker 快照 → 订阅
/// `watchTicker` 推流 → 加载 K 线并订阅 `watchCandles`。
///
/// `_klineRequestId` 竞态序号丢弃过期 K 线响应：用户快速切周期时，先发请求
/// 回调到达时已与当前 `interval` 不一致，直接抛弃避免错乱 state。
///
/// 两条流订阅在 [build] 内经 `ref.onDispose` 统一取消（subs 虽在异步方法内才
/// 创建，闭包读取字段最新值）。
class MarketDetailController extends Notifier<MarketDetailState> {
  MarketDetailController(this.symbol);

  final String symbol;

  static const int _klineHistoryLimit = 200;

  final NotifierLifecycle _life = NotifierLifecycle();
  StreamSubscription<Ticker>? _tickerSub;
  StreamSubscription<Candle>? _candleSub;
  int _klineRequestId = 0;

  bool get mounted => _life.mounted;

  @override
  MarketDetailState build() {
    _life.attach(ref);
    ref.onDispose(() {
      unawaited(_tickerSub?.cancel());
      unawaited(_candleSub?.cancel());
    });
    Future<void>.microtask(_load);
    return const MarketDetailState();
  }

  Future<void> _load() async {
    final tickerRepo = ref.read(tickerRepositoryProvider);
    try {
      final List<Ticker> tickers = await tickerRepo.listTickers();
      Ticker? snapshot;
      for (final Ticker ticker in tickers) {
        if (_sameMarketSymbol(ticker.symbol, symbol)) {
          snapshot = ticker;
          break;
        }
      }
      if (snapshot == null) {
        if (!mounted) return;
        state = state.copyWith(priceSnapshot: null, loading: false);
        return;
      }
      if (!mounted) return;
      // 成交列表随快照一次性构建并缓存（对齐原 `_trades ??=` 语义：
      // 仅首次构建，ticker 推流改价时不重建）。经 tradesRepository 取数，
      // 不再直接 import fixtures（issue #2216）。
      final List<Trade> trades = await ref
          .read(tradesRepositoryProvider)
          .listTrades(symbol: symbol, mid: snapshot.price);
      snapshot = _tickerWithTradeStats(snapshot, trades);
      if (!mounted) return;
      state = state.copyWith(
        priceSnapshot: snapshot,
        loading: false,
        trades: trades,
      );
      _tickerSub = tickerRepo.watchTicker(symbol).listen((Ticker next) {
        if (!mounted) return;
        state = state.copyWith(
          priceSnapshot: _mergeTickerSnapshot(next, state.priceSnapshot),
        );
      });
      unawaited(_loadKline(state.interval));
    } catch (error) {
      if (!mounted) return;
      state = state.copyWith(
        error: ErrorRouter.normalize(error),
        loading: false,
      );
    }
  }

  bool _sameMarketSymbol(String left, String right) {
    return _canonicalSymbol(left) == _canonicalSymbol(right);
  }

  String _canonicalSymbol(String value) {
    final (String base, _) = splitSymbolAssets(value);
    return (base.isEmpty ? value : base).toUpperCase();
  }

  /// 拉取指定周期历史 K 线并重新订阅推流。竞态保护见类注释。
  Future<void> _loadKline(KlineInterval interval) async {
    final int requestId = ++_klineRequestId;
    // 在第一个 await 之前同步读取 provider。
    final klineRepo = ref.read(klineRepositoryProvider);
    // 先解除旧订阅引用，再 await 取消；先置 null 避免并发 _loadKline 中两次
    // 看到相同 subscription 各自 cancel 的窗口（语义更清晰）。
    final StreamSubscription<Candle>? oldSub = _candleSub;
    _candleSub = null;
    await oldSub?.cancel();
    try {
      final List<Candle> history = await klineRepo.listCandles(
        symbol: symbol,
        interval: interval,
        limit: _klineHistoryLimit,
      );
      if (!mounted || requestId != _klineRequestId) return;
      state = state.copyWith(
        candles: history,
        klineError: false,
        priceSnapshot: history.isEmpty
            ? state.priceSnapshot
            : _tickerWithPrice(state.priceSnapshot, history.last.close),
      );
      _candleSub = klineRepo
          .watchCandles(symbol: symbol, interval: interval)
          .listen((Candle next) {
            if (!mounted || requestId != _klineRequestId) return;
            // 当前阶段：append-only。同 openTime upsert 留待真实 WS 接入时补。
            state = state.copyWith(
              candles: <Candle>[...state.candles, next],
              priceSnapshot: _tickerWithPrice(state.priceSnapshot, next.close),
            );
          });
    } catch (_) {
      if (!mounted || requestId != _klineRequestId) return;
      state = state.copyWith(candles: const <Candle>[], klineError: true);
    }
  }

  /// 切 K 线周期：重置 candles + 重新加载订阅（对齐原 onIntervalChanged）。
  void changeInterval(KlineInterval interval) {
    if (interval == state.interval) return;
    state = state.copyWith(
      interval: interval,
      candles: const <Candle>[],
      klineError: false,
    );
    unawaited(_loadKline(interval));
  }

  /// 切数据来源：仅改展示态，不重载（对齐原 SourcePicker / _openSourceSheet）。
  void changeSource(MarketSource source) {
    if (source == state.source) return;
    state = state.copyWith(source: source);
  }

  /// 切 panel：纯展示态（盘口 / 成交 / 深度图）。
  void changePanel(DetailPanel panel) {
    if (panel == state.panel) return;
    state = state.copyWith(panel: panel);
  }

  /// K 线错误重试：清错误标记后重载。
  void retryKline() {
    state = state.copyWith(klineError: false);
    unawaited(_loadKline(state.interval));
  }

  Ticker? _tickerWithPrice(Ticker? ticker, double price) {
    if (ticker == null || !price.isFinite || price <= 0) return ticker;
    return Ticker(
      symbol: ticker.symbol,
      price: price,
      changePercent: ticker.changePercent,
      volume24h: ticker.volume24h,
      kind: ticker.kind,
      high24h: ticker.high24h,
      low24h: ticker.low24h,
      openInterest: ticker.openInterest,
      indexPrice: ticker.indexPrice,
      markPrice: ticker.markPrice,
      fundingRate: ticker.fundingRate,
      turnover24h: ticker.turnover24h,
      netInflow24h: ticker.netInflow24h,
    );
  }

  Ticker _tickerWithTradeStats(Ticker ticker, List<Trade> trades) {
    final double? netInflow =
        ticker.netInflow24h ?? _netInflowFromTrades(trades);
    if (netInflow == ticker.netInflow24h) return ticker;
    return Ticker(
      symbol: ticker.symbol,
      price: ticker.price,
      changePercent: ticker.changePercent,
      volume24h: ticker.volume24h,
      kind: ticker.kind,
      high24h: ticker.high24h,
      low24h: ticker.low24h,
      openInterest: ticker.openInterest,
      indexPrice: ticker.indexPrice,
      markPrice: ticker.markPrice,
      fundingRate: ticker.fundingRate,
      turnover24h: ticker.turnover24h,
      netInflow24h: netInflow,
    );
  }

  Ticker _mergeTickerSnapshot(Ticker next, Ticker? previous) {
    if (previous == null) return next;
    return Ticker(
      symbol: next.symbol,
      price: next.price,
      changePercent: next.changePercent,
      volume24h: next.volume24h,
      kind: next.kind,
      high24h: next.high24h ?? previous.high24h,
      low24h: next.low24h ?? previous.low24h,
      openInterest: next.openInterest ?? previous.openInterest,
      indexPrice: next.indexPrice ?? previous.indexPrice,
      markPrice: next.markPrice ?? previous.markPrice,
      fundingRate: next.fundingRate ?? previous.fundingRate,
      turnover24h: next.turnover24h ?? previous.turnover24h,
      netInflow24h: next.netInflow24h ?? previous.netInflow24h,
    );
  }

  double? _netInflowFromTrades(List<Trade> trades) {
    if (trades.isEmpty) return null;
    double net = 0;
    bool hasValue = false;
    for (final Trade trade in trades) {
      final double notional = trade.price * trade.qty;
      if (!notional.isFinite || notional <= 0) continue;
      hasValue = true;
      net += trade.isBuy ? notional : -notional;
    }
    return hasValue ? net : null;
  }
}

final marketDetailControllerProvider = NotifierProvider.autoDispose
    .family<MarketDetailController, MarketDetailState, String>(
      MarketDetailController.new,
    );
