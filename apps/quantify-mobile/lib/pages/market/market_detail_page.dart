import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/kline_models.dart';
import '../../data/models/long_short_models.dart';
import '../../data/models/ticker_models.dart';
import '../../data/providers.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_kline_placeholder.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_stat_chip.dart';
import '../../widgets/qz_top_bar.dart';
import 'widgets/long_short_bar.dart';
import 'widgets/orderbook_view.dart';

class MarketDetailPage extends ConsumerStatefulWidget {
  const MarketDetailPage({super.key, required this.symbol});

  final String symbol;

  @override
  ConsumerState<MarketDetailPage> createState() => _MarketDetailPageState();
}

class _MarketDetailPageState extends ConsumerState<MarketDetailPage> {
  KlineInterval _interval = KlineInterval.h1;
  Ticker? _priceSnapshot;
  LongShortRatio? _longShort;
  StreamSubscription<Ticker>? _tickerSub;
  bool _loading = true;
  Object? _error;
  int _longShortRequestId = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final tickerRepo = ref.read(tickerRepositoryProvider);
    final longShortRepo = ref.read(longShortRepositoryProvider);
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
      final LongShortRatio ratio = await longShortRepo.getRatio(
        symbol: widget.symbol,
        interval: _interval,
      );
      if (!mounted) return;
      setState(() {
        _priceSnapshot = snapshot;
        _longShort = ratio;
        _loading = false;
      });
      _tickerSub = tickerRepo.watchTicker(widget.symbol).listen((Ticker next) {
        if (!mounted) return;
        setState(() => _priceSnapshot = next);
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  Future<void> _loadLongShort() async {
    final int requestId = ++_longShortRequestId;
    try {
      final LongShortRatio ratio = await ref
          .read(longShortRepositoryProvider)
          .getRatio(symbol: widget.symbol, interval: _interval);
      if (!mounted || requestId != _longShortRequestId) return;
      setState(() => _longShort = ratio);
    } catch (_) {
      if (!mounted || requestId != _longShortRequestId) return;
      setState(() => _longShort = null);
    }
  }

  @override
  void dispose() {
    _tickerSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: QzTopBar(title: widget.symbol, onBack: () => context.pop()),
      body: Builder(
        builder: (BuildContext context) {
          if (_loading) return const Center(child: QzSpinner());
          if (_error != null) {
            return QzEmptyState(title: '${widget.symbol} 加载失败');
          }
          if (_priceSnapshot == null) {
            return QzEmptyState(
              title: widget.symbol,
              subtitle: '未找到该交易对',
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
                QzKlinePlaceholder(
                  value: _intervalLabel(_interval),
                  onChanged: (String value) {
                    setState(() => _interval = _intervalFromLabel(value));
                    _loadLongShort();
                  },
                ),
                const SizedBox(height: QzSpacing.md),
                QzCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      const _SectionTitle('盘口'),
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
                      const _SectionTitle('多空比'),
                      const SizedBox(height: QzSpacing.md),
                      if (_longShort == null)
                        const QzEmptyState(title: '多空比加载失败')
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
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  '行情详情：$displaySymbol',
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

String _intervalLabel(KlineInterval interval) {
  switch (interval) {
    case KlineInterval.m1:
      return '1m';
    case KlineInterval.m5:
      return '5m';
    case KlineInterval.m15:
      return '15m';
    case KlineInterval.h1:
      return '1h';
    case KlineInterval.h4:
      return '4h';
    case KlineInterval.d1:
      return '1d';
  }
}

KlineInterval _intervalFromLabel(String label) {
  switch (label) {
    case '1m':
      return KlineInterval.m1;
    case '5m':
      return KlineInterval.m5;
    case '15m':
      return KlineInterval.m15;
    case '4h':
      return KlineInterval.h4;
    case '1d':
      return KlineInterval.d1;
    case '1h':
    default:
      return KlineInterval.h1;
  }
}
