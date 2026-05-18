import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_pill.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzPill golden baseline (light+violet)', (tester) async {
    await pumpQz(
      tester,
      const QzPill(label: 'PILL'),
    );
    await expectLater(
      find.byType(QzPill),
      matchesGoldenFile('goldens/qz_pill.png'),
    );
  });

  testWidgets('QzPill renders cleanly under 9 themes', (tester) async {
    await verifyAllThemes(
      tester,
      () => const QzPill(label: 'NEW'),
      (t) async {
        expect(find.text('NEW'), findsOneWidget);
      },
    );
  });
}
