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

  testWidgets('AI tab label reads "AI 量化" (设计稿对齐 #1591)', (tester) async {
    await pumpQz(
      tester,
      SizedBox(
        width: 360,
        child: QzBottomTabBar(currentIndex: 0, onTap: (_) {}),
      ),
      surfaceSize: const Size(360, 80),
    );
    expect(find.text('AI 量化'), findsOneWidget);
    expect(find.text('AI'), findsNothing);
  });

  testWidgets('active tab paints accentSoft pill behind icon', (tester) async {
    await pumpQz(
      tester,
      SizedBox(
        width: 360,
        child: QzBottomTabBar(currentIndex: 2, onTap: (_) {}),
      ),
      surfaceSize: const Size(360, 80),
    );
    // Locate the pill Container that wraps the active 'strategy' icon —
    // the closest ancestor Container of the icon must carry a non-null
    // background color (the accentSoft pill); inactive items have a
    // transparent pill slot.
    final Finder activeIcon = find.byKey(const ValueKey<String>('tab-strategy'));
    final Finder activePill = find
        .ancestor(of: activeIcon, matching: find.byType(Container))
        .first;
    final Container activeBox = tester.widget<Container>(activePill);
    final BoxDecoration activeDeco = activeBox.decoration! as BoxDecoration;
    expect(activeDeco.color, isNot(equals(Colors.transparent)));
    expect(activeDeco.color, isNotNull);

    final Finder inactiveIcon = find.byKey(const ValueKey<String>('tab-ai'));
    final Finder inactivePill = find
        .ancestor(of: inactiveIcon, matching: find.byType(Container))
        .first;
    final Container inactiveBox = tester.widget<Container>(inactivePill);
    final BoxDecoration inactiveDeco =
        inactiveBox.decoration! as BoxDecoration;
    expect(inactiveDeco.color, equals(Colors.transparent));
  });
}
