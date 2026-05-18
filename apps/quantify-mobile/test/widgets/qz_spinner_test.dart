import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_spinner.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzSpinner golden baseline (light+violet)', (tester) async {
    // Wrap the spinner in TickerMode(enabled: false) to actually freeze its
    // indeterminate rotation animation — otherwise the captured frame depends
    // on Flutter SDK curve math and turns the golden into a flaky test.
    await pumpQz(
      tester,
      const TickerMode(
        enabled: false,
        child: QzSpinner(size: 24),
      ),
    );
    await expectLater(
      find.byType(QzSpinner),
      matchesGoldenFile('goldens/qz_spinner.png'),
    );
  });

  testWidgets('QzSpinner renders cleanly under 9 themes', (tester) async {
    await verifyAllThemes(
      tester,
      () => const QzSpinner(),
      (t) async {
        expect(find.byType(CircularProgressIndicator), findsOneWidget);
      },
    );
  });
}
