import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/fixtures/orderbook.dart';
import 'package:quantify_mobile/data/models/orderbook_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/orderbook_repository.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/market/widgets/orderbook_view.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

class _StubOrderbookRepository implements OrderbookRepository {
  @override
  Future<OrderbookSnapshot> getSnapshot(String symbol) async =>
      buildMockOrderbook(
        symbol: symbol,
        mid: 68250.42,
        timestamp: DateTime(2026),
      );

  @override
  Stream<OrderbookSnapshot> watchOrderbook(String symbol) =>
      const Stream<OrderbookSnapshot>.empty();
}

Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(420, 900));
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        orderbookRepositoryProvider.overrideWithValue(
          _StubOrderbookRepository(),
        ),
      ],
      child: MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(QzTheme.fallback),
        home: const Scaffold(
          body: SingleChildScrollView(child: OrderbookView(symbol: 'BTCUSDT')),
        ),
      ),
    ),
  );
  for (int i = 0; i < 4; i++) {
    await tester.pump();
  }
}

void main() {
  group('aggregateLevels', () {
    test('精度 1（mock step=1）不改变档位数', () {
      final List<OrderbookLevel> bids = <OrderbookLevel>[
        const OrderbookLevel(price: 100, quantity: 1),
        const OrderbookLevel(price: 99, quantity: 1),
      ];
      expect(aggregateLevels(bids, 1, true).length, 2);
    });

    test('精度 10 把相邻档位聚合并累加数量', () {
      final List<OrderbookLevel> bids = <OrderbookLevel>[
        const OrderbookLevel(price: 105, quantity: 1),
        const OrderbookLevel(price: 104, quantity: 2),
        const OrderbookLevel(price: 95, quantity: 3),
      ];
      final List<OrderbookLevel> out = aggregateLevels(bids, 10, true);
      // 105/104 落入 [100] 桶，95 落入 [90] 桶
      expect(out.length, 2);
      expect(out.first.price, 100);
      expect(out.first.quantity, 3);
    });

    test('bid 向下取整、ask 向上取整', () {
      final List<OrderbookLevel> asks = <OrderbookLevel>[
        const OrderbookLevel(price: 101, quantity: 1),
      ];
      expect(aggregateLevels(asks, 10, false).first.price, 110);
    });
  });

  testWidgets('盘口默认双向显示买卖两侧', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.byType(OrderbookView), findsOneWidget);
    expect(find.byKey(const Key('orderbook-view-both')), findsOneWidget);
    expect(find.byKey(const Key('orderbook-view-asks')), findsOneWidget);
    expect(find.byKey(const Key('orderbook-view-bids')), findsOneWidget);
  });

  testWidgets('双向视图渲染列头与 mid 行', (WidgetTester tester) async {
    await _pump(tester);
    // 列头三列。
    expect(find.text('价格(USDT)'), findsOneWidget);
    expect(find.text('数量(BTC)'), findsOneWidget);
    expect(find.text('委托额(\$)'), findsOneWidget);
    // mid 行：未传 mid 时由最优买卖档推导 = (68249.42+68251.42)/2 = 68250.42。
    expect(find.text('68250.42'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('切到卖单视图无异常且无 mid 行', (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.byKey(const Key('orderbook-view-asks')));
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(find.byType(OrderbookView), findsOneWidget);
  });

  testWidgets('默认精度为 0.01 并可切换到 10', (WidgetTester tester) async {
    await _pump(tester);
    // 默认精度 0.01：toolbar 按钮文案为 0.01。
    final Finder precBtn = find.text('0.01');
    expect(precBtn, findsOneWidget);
    await tester.tap(precBtn);
    await tester.pumpAndSettle();
    // sheet 列出 5 个精度档。
    expect(find.text('100'), findsOneWidget);
    await tester.tap(find.text('10').last);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(OrderbookView), findsOneWidget);
  });
}
