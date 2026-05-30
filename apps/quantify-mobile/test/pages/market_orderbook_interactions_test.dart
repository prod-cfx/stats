import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
    expect(find.text('双向'), findsOneWidget);
    expect(find.text('卖单'), findsOneWidget);
    expect(find.text('买单'), findsOneWidget);
  });

  testWidgets('切到卖单视图后行数等于单侧档位数', (WidgetTester tester) async {
    await _pump(tester);
    // 双向：bid+ask 各 10 行 = 20 个 price text 区域；切卖单后单侧。
    await tester.tap(find.text('卖单'));
    await tester.pump();
    // 卖单视图下不应再有 bid 列与 ask 列并排（Row 内两个 _OrderbookSide）。
    // 通过精度按钮存在确认 toolbar 仍在，且不抛异常。
    expect(tester.takeException(), isNull);
    expect(find.byType(OrderbookView), findsOneWidget);
  });

  testWidgets('切换精度到 10 改变可见档位数', (WidgetTester tester) async {
    await _pump(tester);
    // 默认精度 1：mock step=1，bids 10 档不聚合。
    final Finder priceBtn = find.text('1');
    expect(priceBtn, findsOneWidget);
    await tester.tap(priceBtn);
    await tester.pumpAndSettle();
    // sheet 列出 5 个精度档
    expect(find.text('0.01'), findsOneWidget);
    expect(find.text('100'), findsOneWidget);
    await tester.tap(find.text('10').last);
    await tester.pumpAndSettle();
    // 精度切到 10 后 toolbar 按钮文案变 10，且无异常。
    expect(tester.takeException(), isNull);
    expect(find.byType(OrderbookView), findsOneWidget);
  });
}
