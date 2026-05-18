import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/mock/fixtures/tickers.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/ticker_repository.dart';
import 'package:quantify_mobile/pages/market/market_detail_page.dart';
import 'package:quantify_mobile/pages/market/market_home_page.dart';
import 'package:quantify_mobile/pages/market/widgets/ticker_row.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

class _FakeTickerRepository implements TickerRepository {
  final Map<String, StreamController<Ticker>> controllers =
      <String, StreamController<Ticker>>{};

  @override
  Future<List<Ticker>> listTickers() async => mockTickers;

  @override
  Stream<Ticker> watchTicker(String symbol) {
    final StreamController<Ticker> controller = controllers.putIfAbsent(
      symbol,
      () => StreamController<Ticker>.broadcast(),
    );
    return controller.stream;
  }
}

Future<void> _pump(
  WidgetTester tester,
  _FakeTickerRepository repo, {
  QzTheme theme = QzTheme.fallback,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 3000));
  final GoRouter router = GoRouter(
    initialLocation: '/market',
    routes: <RouteBase>[
      GoRoute(
        path: '/market',
        builder: (BuildContext context, GoRouterState state) =>
            const MarketHomePage(),
      ),
      GoRoute(
        path: r'/market/:symbol([A-Z0-9-]{2,})',
        builder: (BuildContext context, GoRouterState s) =>
            MarketDetailPage(symbol: s.pathParameters['symbol']!),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[tickerRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp.router(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(theme),
        routerConfig: router,
      ),
    ),
  );
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets('/market 渲染 20+ 行情条，自选 5 条，推流变价', (WidgetTester tester) async {
    expect(mockTickers.length, greaterThanOrEqualTo(24));
    final _FakeTickerRepository repo = _FakeTickerRepository();
    await _pump(tester, repo);

    expect(find.byType(TickerRow), findsAtLeastNWidgets(20));

    await tester.tap(find.text('自选'));
    await tester.pump();
    expect(find.byType(TickerRow), findsNWidgets(5));

    repo.controllers['BTCUSDT']!.add(
      const Ticker(
        symbol: 'BTCUSDT',
        price: 70123.45,
        changePercent: 2.22,
        volume24h: 2.13e10,
      ),
    );
    await tester.pump();
    expect(find.text('70123.45'), findsOneWidget);
  });

  testWidgets('MarketHomePage 9 主题循环 pump 不抛异常', (WidgetTester tester) async {
    for (final QzBg bg in QzBg.values) {
      for (final QzAccent accent in QzAccent.values) {
        await _pump(
          tester,
          _FakeTickerRepository(),
          theme: QzTheme(bg: bg, accent: accent),
        );
        expect(find.byType(TickerRow), findsAtLeastNWidgets(20));
        expect(
          tester.takeException(),
          isNull,
          reason: 'theme bg=$bg accent=$accent',
        );
      }
    }
  });

  testWidgets('点击行情行 push /market/:symbol 进入详情页', (WidgetTester tester) async {
    final _FakeTickerRepository repo = _FakeTickerRepository();
    await _pump(tester, repo);

    await tester.tap(find.byType(TickerRow).first);
    await tester.pumpAndSettle();

    expect(find.byType(MarketDetailPage), findsOneWidget);
    expect(find.byType(MarketHomePage), findsNothing);
    expect(find.text('行情详情：BTCUSDT'), findsOneWidget);
  });
}
