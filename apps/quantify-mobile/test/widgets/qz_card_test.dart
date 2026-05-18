import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_card.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzCard golden baseline (light+violet)', (tester) async {
    await pumpQz(
      tester,
      const SizedBox(
        width: 280,
        child: QzCard(child: Text('Card content')),
      ),
    );
    await expectLater(
      find.byType(QzCard),
      matchesGoldenFile('goldens/qz_card.png'),
    );
  });

  testWidgets('QzCard renders cleanly under 9 themes', (tester) async {
    await verifyAllThemes(
      tester,
      () => const SizedBox(
        width: 280,
        child: QzCard(child: Text('Card')),
      ),
      (t) async {
        expect(find.text('Card'), findsOneWidget);
      },
    );
  });

  testWidgets('QzCard onTap fires when supplied', (tester) async {
    int taps = 0;
    await pumpQz(
      tester,
      QzCard(
        onTap: () => taps++,
        child: const SizedBox(
          width: 200,
          height: 60,
          child: Center(child: Text('Tap me')),
        ),
      ),
    );
    await tester.tap(find.byType(QzCard));
    await tester.pump();
    expect(taps, 1);
  });
}
