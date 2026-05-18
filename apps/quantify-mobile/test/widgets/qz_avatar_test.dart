import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_avatar.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzAvatar golden baseline (light+violet)', (tester) async {
    await pumpQz(
      tester,
      const QzAvatar(label: 'BTC', monospace: true, size: 40),
    );
    await expectLater(
      find.byType(QzAvatar),
      matchesGoldenFile('goldens/qz_avatar.png'),
    );
  });

  testWidgets('QzAvatar renders cleanly under 9 themes', (tester) async {
    await verifyAllThemes(
      tester,
      () => const QzAvatar(label: 'A'),
      (t) async {
        expect(find.text('A'), findsOneWidget);
      },
    );
  });
}
