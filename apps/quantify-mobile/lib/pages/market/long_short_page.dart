import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/mock/fixtures/long_short.dart';
import '../../data/mock/fixtures/tickers.dart';
import '../../data/models/exchange_long_short_models.dart';
import '../../data/models/kline_models.dart';
import '../../data/models/long_short_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_segmented_tabs.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_top_bar.dart';
import 'widgets/exchange_long_short_tile.dart';
import 'widgets/long_short_bar.dart';
import 'widgets/long_short_hero_card.dart';

class LongShortPage extends ConsumerStatefulWidget {
  const LongShortPage({super.key});

  @override
  ConsumerState<LongShortPage> createState() => _LongShortPageState();
}

class _LongShortPageState extends ConsumerState<LongShortPage> {
  String _symbol = 'BTCUSDT';
  KlineInterval _interval = KlineInterval.h1;
  MarketLongShortSnapshot? _snapshot;
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
      final MarketLongShortSnapshot snapshot = await ref
          .read(longShortRepositoryProvider)
          .getSnapshot(symbol: _symbol);
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _snapshot = snapshot;
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
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<String> symbols = mockTickers
        .map((ticker) => ticker.symbol)
        .take(8)
        .toList();
    return Scaffold(
      appBar: QzTopBar(
        title: l10n.marketLongShortTitle,
        subtitle: l10n.marketLongShortSubtitle,
        actions: <Widget>[
          IconButton(
            icon: const Icon(Icons.refresh, size: 20),
            color: c.text,
            tooltip: l10n.marketLongShortRefreshTooltip,
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
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
              },
            ),
            const SizedBox(height: QzSpacing.md),
            if (_loading)
              const QzCard(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: QzSpinner()),
              )
            else if (_error != null || _snapshot == null)
              QzCard(
                child: QzEmptyState(
                  title: l10n.marketLongShortLoadError,
                ),
              )
            else ...<Widget>[
              LongShortHeroCard(snapshot: _snapshot!),
              const SizedBox(height: QzSpacing.md),
              _ExchangeSectionHeader(
                title: l10n.marketLongShortExchangesTitle,
                hint: l10n.marketLongShortExchangesSortBy,
              ),
              QzCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: <Widget>[
                    for (int i = 0; i < _snapshot!.exchanges.length; i++)
                      ExchangeLongShortTile(
                        rank: i + 1,
                        item: _snapshot!.exchanges[i],
                        showDivider: i < _snapshot!.exchanges.length - 1,
                      ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: QzSpacing.md),
            _HistoryCard(symbol: _symbol),
          ],
        ),
      ),
    );
  }
}

class _ExchangeSectionHeader extends StatelessWidget {
  const _ExchangeSectionHeader({required this.title, required this.hint});

  final String title;
  final String hint;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, QzSpacing.sm, 4, 10),
      child: Row(
        children: <Widget>[
          Text(
            title,
            style: TextStyle(
              color: c.textMid,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          Text(
            hint,
            style: TextStyle(
              color: c.textDim,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.symbol});

  final String symbol;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<LongShortRatio> history =
        mockLongShortHistory[symbol] ?? const <LongShortRatio>[];
    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.marketLongShortHistorySection,
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
