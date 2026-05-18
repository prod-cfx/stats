import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/mock/fixtures/long_short.dart';
import '../../data/mock/fixtures/tickers.dart';
import '../../data/models/kline_models.dart';
import '../../data/models/long_short_models.dart';
import '../../data/providers.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_segmented_tabs.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_top_bar.dart';
import 'widgets/long_short_bar.dart';

class LongShortPage extends ConsumerStatefulWidget {
  const LongShortPage({super.key});

  @override
  ConsumerState<LongShortPage> createState() => _LongShortPageState();
}

class _LongShortPageState extends ConsumerState<LongShortPage> {
  String _symbol = 'BTCUSDT';
  KlineInterval _interval = KlineInterval.h1;
  LongShortRatio? _ratio;
  bool _loading = true;
  Object? _error;
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final int requestId = ++_requestId;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final LongShortRatio ratio = await ref
          .read(longShortRepositoryProvider)
          .getRatio(symbol: _symbol, interval: _interval);
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _ratio = ratio;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<String> symbols = mockTickers
        .map((ticker) => ticker.symbol)
        .take(8)
        .toList();
    return Scaffold(
      appBar: const QzTopBar(title: '多空比'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(QzSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: QzSegmentedTabs(
                options: symbols,
                value: _symbol,
                onChanged: (String value) {
                  setState(() => _symbol = value);
                  _load();
                },
              ),
            ),
            const SizedBox(height: QzSpacing.md),
            QzSegmentedTabs(
              options: const <String>['1m', '5m', '15m', '1h', '4h', '1d'],
              value: _intervalLabel(_interval),
              onChanged: (String value) {
                setState(() => _interval = _intervalFromLabel(value));
                _load();
              },
            ),
            const SizedBox(height: QzSpacing.md),
            QzCard(
              child: Builder(
                builder: (BuildContext context) {
                  if (_loading) return const Center(child: QzSpinner());
                  if (_error != null || _ratio == null) {
                    return const QzEmptyState(title: '多空比加载失败');
                  }
                  return LongShortBar(
                    longRatio: _ratio!.longRatio,
                    shortRatio: _ratio!.shortRatio,
                    height: 36,
                  );
                },
              ),
            ),
            const SizedBox(height: QzSpacing.md),
            _HistoryCard(symbol: _symbol),
          ],
        ),
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.symbol});

  final String symbol;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final List<LongShortRatio> history =
        mockLongShortHistory[symbol] ?? const <LongShortRatio>[];
    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            '历史',
            style: TextStyle(
              color: c.textMid,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: QzSpacing.md),
          for (final LongShortRatio item in history) ...<Widget>[
            Row(
              children: <Widget>[
                SizedBox(
                  width: 96,
                  child: Text(
                    _formatTime(item.timestamp),
                    style: TextStyle(color: c.textDim, fontSize: 12),
                  ),
                ),
                Expanded(
                  child: LongShortBar(
                    longRatio: item.longRatio,
                    shortRatio: item.shortRatio,
                    height: 22,
                  ),
                ),
              ],
            ),
            const SizedBox(height: QzSpacing.sm),
          ],
        ],
      ),
    );
  }

  String _formatTime(DateTime timestamp) {
    final String month = timestamp.month.toString().padLeft(2, '0');
    final String day = timestamp.day.toString().padLeft(2, '0');
    final String hour = timestamp.hour.toString().padLeft(2, '0');
    final String minute = timestamp.minute.toString().padLeft(2, '0');
    return '$month-$day $hour:$minute';
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
