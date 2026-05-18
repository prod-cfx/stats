import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_segmented_tabs.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzSegmentedTabs golden baseline (light+violet)',
      (tester) async {
    await pumpQz(
      tester,
      QzSegmentedTabs(
        options: const <String>['1m', '5m', '15m', '1h'],
        value: '5m',
        onChanged: (_) {},
      ),
    );
    await expectLater(
      find.byType(QzSegmentedTabs),
      matchesGoldenFile('goldens/qz_segmented_tabs.png'),
    );
  });

  testWidgets('QzSegmentedTabs renders cleanly under 9 themes',
      (tester) async {
    await verifyAllThemes(
      tester,
      () => QzSegmentedTabs(
        options: const <String>['A', 'B'],
        value: 'A',
        onChanged: (_) {},
      ),
      (t) async {
        expect(find.text('A'), findsOneWidget);
        expect(find.text('B'), findsOneWidget);
      },
    );
  });

  testWidgets('QzSegmentedTabs onChanged fires with tapped option',
      (tester) async {
    String? picked;
    await pumpQz(
      tester,
      QzSegmentedTabs(
        options: const <String>['x', 'y'],
        value: 'x',
        onChanged: (v) => picked = v,
      ),
    );
    await tester.tap(find.text('y'));
    await tester.pump();
    expect(picked, 'y');
  });
}
