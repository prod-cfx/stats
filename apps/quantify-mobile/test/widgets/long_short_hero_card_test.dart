import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/exchange_long_short_models.dart';
import 'package:quantify_mobile/pages/market/widgets/long_short_hero_card.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('LongShortHeroCard uses compact total card design', (
    WidgetTester tester,
  ) async {
    await pumpQz(
      tester,
      LongShortHeroCard(
        snapshot: MarketLongShortSnapshot(
          symbol: 'BTCUSDT',
          baseAsset: 'BTC',
          assetGlyph: 'B',
          assetGradientStart: Colors.orange,
          assetGradientEnd: Colors.deepOrange,
          totalNotional: r'$3.14B',
          longNotional: r'$1.82B',
          shortNotional: r'$1.32B',
          longPct: 58,
          shortPct: 42,
          exchanges: const <ExchangeLongShort>[],
          timestamp: DateTime.utc(2026),
        ),
      ),
      surfaceSize: const Size(390, 180),
    );

    expect(find.text('全部'), findsOneWidget);
    expect(find.text('BTC 总计'), findsOneWidget);
    expect(find.text('LIVE'), findsNothing);
    expect(find.text(r'US$1.82B'), findsOneWidget);
    expect(find.text(r'US$1.32B'), findsOneWidget);

    final Size glyphSize = tester.getSize(
      find.byKey(const Key('long-short-hero-asset-glyph')),
    );
    expect(glyphSize, const Size(30, 30));
  });
}
