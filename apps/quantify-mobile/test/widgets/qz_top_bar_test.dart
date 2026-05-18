import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_top_bar.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzTopBar golden baseline (light+violet)', (tester) async {
    await pumpQz(
      tester,
      Scaffold(
        appBar: const QzTopBar(
          title: 'Market',
          subtitle: 'BTC · 1m',
        ),
        body: const SizedBox.shrink(),
      ),
      surfaceSize: const Size(360, 140),
    );
    await expectLater(
      find.byType(QzTopBar),
      matchesGoldenFile('goldens/qz_top_bar.png'),
    );
  });

  testWidgets('QzTopBar renders cleanly under 9 themes', (tester) async {
    await verifyAllThemes(
      tester,
      () => Scaffold(
        appBar: const QzTopBar(title: 'Title'),
        body: const SizedBox.shrink(),
      ),
      (t) async {
        expect(find.text('Title'), findsOneWidget);
      },
      surfaceSize: const Size(360, 140),
    );
  });

  testWidgets('QzTopBar onBack injects a back button', (tester) async {
    int taps = 0;
    await pumpQz(
      tester,
      Scaffold(
        appBar: QzTopBar(
          title: 'Detail',
          onBack: () => taps++,
        ),
        body: const SizedBox.shrink(),
      ),
      surfaceSize: const Size(360, 140),
    );
    expect(find.byIcon(Icons.arrow_back_ios_new), findsOneWidget);
    await tester.tap(find.byIcon(Icons.arrow_back_ios_new));
    await tester.pump();
    expect(taps, 1);
  });
}
