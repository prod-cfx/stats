import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_bottom_tab_bar.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzBottomTabBar golden baseline (light+violet)', (tester) async {
    await pumpQz(
      tester,
      SizedBox(
        width: 360,
        child: QzBottomTabBar(
          currentIndex: 0,
          onTap: (_) {},
        ),
      ),
      surfaceSize: const Size(360, 80),
    );
    await expectLater(
      find.byType(QzBottomTabBar),
      matchesGoldenFile('goldens/qz_bottom_tab_bar.png'),
    );
  });

  testWidgets('QzBottomTabBar renders cleanly under 9 themes',
      (tester) async {
    await verifyAllThemes(
      tester,
      () => QzBottomTabBar(currentIndex: 1, onTap: (_) {}),
      (t) async {
        expect(find.byKey(const ValueKey<String>('tab-ai')), findsOneWidget);
        expect(find.byKey(const ValueKey<String>('tab-market')), findsOneWidget);
      },
      surfaceSize: const Size(360, 80),
    );
  });
}
