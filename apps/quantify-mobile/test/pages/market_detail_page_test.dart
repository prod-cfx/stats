import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/mock/fixtures/orderbook.dart';
import 'package:quantify_mobile/data/mock/fixtures/tickers.dart';
import 'package:quantify_mobile/data/models/kline_models.dart';
import 'package:quantify_mobile/data/models/long_short_models.dart';
import 'package:quantify_mobile/data/models/orderbook_models.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/long_short_repository.dart';
import 'package:quantify_mobile/data/repositories/orderbook_repository.dart';
import 'package:quantify_mobile/data/repositories/ticker_repository.dart';
import 'package:quantify_mobile/pages/market/market_detail_page.dart';
import 'package:quantify_mobile/pages/market/widgets/orderbook_view.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_kline_placeholder.dart';

class _FakeTickerRepository implements TickerRepository {
  @override
  Future<List<Ticker>> listTickers() async => mockTickers;

  @override
  Stream<Ticker> watchTicker(String symbol) => const Stream<Ticker>.empty();
}

class _FakeOrderbookRepository implements OrderbookRepository {
  final StreamController<OrderbookSnapshot> controller =
      StreamController<OrderbookSnapshot>.broadcast();

  @override
  Future<OrderbookSnapshot> getSnapshot(String symbol) async =>
      buildMockOrderbook(
        symbol: symbol,
        mid: 68250.42,
        timestamp: DateTime(2026),
      );

  @override
  Stream<OrderbookSnapshot> watchOrderbook(String symbol) => controller.stream;
}

class _FakeLongShortRepository implements LongShortRepository {
  @override
  Future<LongShortRatio> getRatio({
    required String symbol,
    required KlineInterval interval,
  }) async => LongShortRatio(
    symbol: symbol,
    longRatio: 0.58,
    shortRatio: 0.42,
    timestamp: DateTime(2026),
  );
}

Future<void> _pump(
  WidgetTester tester,
  _FakeOrderbookRepository orderbookRepo, {
  QzTheme theme = QzTheme.fallback,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 1600));
  final GoRouter router = GoRouter(
    initialLocation: '/market/BTCUSDT',
    routes: <RouteBase>[
      GoRoute(
        path: r'/market/:symbol([A-Z0-9-]{2,})',
        builder: (BuildContext context, GoRouterState s) =>
            MarketDetailPage(symbol: s.pathParameters['symbol']!),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        tickerRepositoryProvider.overrideWithValue(_FakeTickerRepository()),
        orderbookRepositoryProvider.overrideWithValue(orderbookRepo),
        longShortRepositoryProvider.overrideWithValue(
          _FakeLongShortRepository(),
        ),
      ],
      child: MaterialApp.router(
        theme: buildQzThemeData(theme),
        routerConfig: router,
      ),
    ),
  );
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets('MarketDetailPage 渲染价格、K 线占位，盘口推流刷新', (
    WidgetTester tester,
  ) async {
    final _FakeOrderbookRepository orderbookRepo = _FakeOrderbookRepository();
    await _pump(tester, orderbookRepo);

    expect(find.byType(QzKlinePlaceholder), findsOneWidget);
    expect(find.text('68250.42'), findsOneWidget);
    expect(find.byType(OrderbookView), findsOneWidget);

    orderbookRepo.controller.add(
      OrderbookSnapshot(
        symbol: 'BTCUSDT',
        bids: const <OrderbookLevel>[
          OrderbookLevel(price: 68249.00, quantity: 9.999),
        ],
        asks: const <OrderbookLevel>[
          OrderbookLevel(price: 68251.00, quantity: 8.888),
        ],
        timestamp: DateTime(2026),
      ),
    );
    await tester.pump();
    expect(find.text('9.999'), findsOneWidget);
    expect(find.text('8.888'), findsOneWidget);
  });

  testWidgets('MarketDetailPage 9 主题循环 pump 不抛异常', (WidgetTester tester) async {
    for (final QzBg bg in QzBg.values) {
      for (final QzAccent accent in QzAccent.values) {
        await _pump(
          tester,
          _FakeOrderbookRepository(),
          theme: QzTheme(bg: bg, accent: accent),
        );
        expect(find.byType(QzKlinePlaceholder), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
    }
  });
}
