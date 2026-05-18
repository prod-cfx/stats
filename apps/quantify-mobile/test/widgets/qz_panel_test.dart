import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_panel.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzPanel golden baseline (light+violet)', (tester) async {
    await pumpQz(
      tester,
      const SizedBox(
        width: 280,
        child: QzPanel(child: Text('Nested row')),
      ),
    );
    await expectLater(
      find.byType(QzPanel),
      matchesGoldenFile('goldens/qz_panel.png'),
    );
  });

  testWidgets('QzPanel renders cleanly under 9 themes', (tester) async {
    await verifyAllThemes(
      tester,
      () => const SizedBox(
        width: 280,
        child: QzPanel(child: Text('Panel')),
      ),
      (t) async {
        expect(find.text('Panel'), findsOneWidget);
      },
    );
  });
}
