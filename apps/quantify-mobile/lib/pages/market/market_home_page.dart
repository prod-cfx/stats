import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/ticker_models.dart';
import '../../data/providers.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_segmented_tabs.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_top_bar.dart';
import 'widgets/ticker_row.dart';

const Set<String> _kFavoriteSet = <String>{
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
};

class MarketHomePage extends ConsumerStatefulWidget {
  const MarketHomePage({super.key});

  @override
  ConsumerState<MarketHomePage> createState() => _MarketHomePageState();
}

class _MarketHomePageState extends ConsumerState<MarketHomePage> {
  String _tab = '全部';
  List<Ticker> _tickers = <Ticker>[];
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repo = ref.read(tickerRepositoryProvider);
    try {
      final List<Ticker> tickers = await repo.listTickers();
      if (!mounted) return;
      setState(() {
        _tickers = tickers;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final List<Ticker> visible = _tab == '自选'
        ? _tickers
              .where((Ticker t) => _kFavoriteSet.contains(t.symbol))
              .toList()
        : _tickers;
    return Scaffold(
      appBar: const QzTopBar(title: '行情'),
      body: Column(
        children: <Widget>[
          Container(
            width: double.infinity,
            color: c.bgElev,
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.sm,
              QzSpacing.lg,
              QzSpacing.md,
            ),
            child: QzSegmentedTabs(
              options: const <String>['自选', '全部'],
              value: _tab,
              onChanged: (String value) => setState(() => _tab = value),
            ),
          ),
          Expanded(
            child: Builder(
              builder: (BuildContext context) {
                if (_loading) return const Center(child: QzSpinner());
                if (_error != null) {
                  return const QzEmptyState(title: '行情加载失败');
                }
                if (visible.isEmpty) {
                  return const QzEmptyState(title: '暂无行情');
                }
                return ListView.separated(
                  itemCount: visible.length,
                  separatorBuilder: (BuildContext context, int index) =>
                      Divider(height: 1, color: c.borderSoft),
                  itemBuilder: (BuildContext context, int index) {
                    final Ticker ticker = visible[index];
                    return TickerRow(
                      key: Key('ticker-row-${ticker.symbol}'),
                      ticker: ticker,
                      onTap: () => context.push('/market/${ticker.symbol}'),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
