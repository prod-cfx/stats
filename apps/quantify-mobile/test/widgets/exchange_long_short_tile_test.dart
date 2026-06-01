import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/exchange_long_short_models.dart';
import 'package:quantify_mobile/pages/market/widgets/exchange_long_short_tile.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('ExchangeLongShortTile matches LSRow structure', (
    WidgetTester tester,
  ) async {
    await pumpQz(
      tester,
      const ExchangeLongShortTile(
        rank: 7,
        item: ExchangeLongShort(
          exchange: 'Binance',
          color: Color(0xFFF0B90B),
          glyph: 'B',
          longAmount: r'$1.82B',
          shortAmount: r'$1.32B',
          longPct: 58,
          shortPct: 42,
        ),
      ),
      surfaceSize: const Size(390, 130),
    );

    expect(find.text('7'), findsNothing);
    expect(find.text('Binance'), findsOneWidget);
    expect(find.text('做多'), findsOneWidget);
    expect(find.text('做空'), findsOneWidget);
    expect(find.text('58.0%'), findsOneWidget);
    expect(find.text('42.0%'), findsOneWidget);

    final Size iconSize = tester.getSize(
      find.byKey(const Key('exchange-long-short-icon-Binance')),
    );
    final Size barSize = tester.getSize(
      find.byKey(const Key('exchange-long-short-ratio-bar-Binance')),
    );
    expect(iconSize, const Size(20, 20));
    expect(barSize.height, 18);
  });

  testWidgets('ExchangeLongShortTile renders dashed empty ratio placeholder', (
    WidgetTester tester,
  ) async {
    await pumpQz(
      tester,
      const ExchangeLongShortTile(
        rank: 1,
        item: ExchangeLongShort(
          exchange: 'EmptyX',
          color: Colors.grey,
          glyph: 'E',
          longAmount: r'$0',
          shortAmount: r'$0',
          longPct: 0,
          shortPct: 0,
        ),
      ),
      surfaceSize: const Size(390, 130),
    );

    expect(
      find.byKey(const Key('exchange-long-short-empty-bar-EmptyX')),
      findsOneWidget,
    );
    expect(find.text('50.0%'), findsNothing);
  });
}
