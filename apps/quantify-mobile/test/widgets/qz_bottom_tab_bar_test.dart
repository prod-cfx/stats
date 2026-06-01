import 'dart:ui';

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

  testWidgets('tabs render in canonical order: strategy → ai → market → whale → me',
      (tester) async {
    // Source-of-truth guard for issue #1637 / #1881: lock the visual
    // left-to-right order of tabs so any future reshuffle in QzBottomTabBar
    // trips this test (not just docs / golden).
    await pumpQz(
      tester,
      SizedBox(
        width: 360,
        child: QzBottomTabBar(currentIndex: 0, onTap: (_) {}),
      ),
      surfaceSize: const Size(360, 80),
    );

    const List<String> expectedKeys = <String>[
      'tab-strategy',
      'tab-ai',
      'tab-market',
      'tab-whale',
      'tab-me',
    ];
    const List<String> expectedLabels = <String>[
      '策略',
      'AI 量化',
      '数据',
      '巨鲸',
      '我的',
    ];

    // Sort the 5 tab icons by their on-screen X position; the resulting key
    // sequence must equal the canonical order.
    final List<Element> iconElements = expectedKeys
        .map((String k) =>
            tester.element(find.byKey(ValueKey<String>(k))))
        .toList();
    iconElements.sort((Element a, Element b) {
      final Offset aPos = (a.renderObject! as RenderBox).localToGlobal(Offset.zero);
      final Offset bPos = (b.renderObject! as RenderBox).localToGlobal(Offset.zero);
      return aPos.dx.compareTo(bPos.dx);
    });
    final List<String> orderedKeys = iconElements
        .map((Element e) => (e.widget.key! as ValueKey<String>).value)
        .toList();
    expect(orderedKeys, equals(expectedKeys));

    // And the labels appear in the same left-to-right order so designers
    // catch label swaps even if keys stay stable.
    final List<Element> labelElements = expectedLabels
        .map((String label) => tester.element(find.text(label)))
        .toList();
    labelElements.sort((Element a, Element b) {
      final Offset aPos = (a.renderObject! as RenderBox).localToGlobal(Offset.zero);
      final Offset bPos = (b.renderObject! as RenderBox).localToGlobal(Offset.zero);
      return aPos.dx.compareTo(bPos.dx);
    });
    final List<String> orderedLabels = labelElements
        .map((Element e) => (e.widget as Text).data!)
        .toList();
    expect(orderedLabels, equals(expectedLabels));
  });

  testWidgets('background uses real BackdropFilter blur (frosted glass)',
      (tester) async {
    // Issue #1642: TabBar must apply a real ImageFilter.blur via
    // BackdropFilter (clipped by ClipRect to bar bounds), not just a
    // semi-transparent tint. Guards against regressions that strip the
    // BackdropFilter back to a flat DecoratedBox.
    await pumpQz(
      tester,
      SizedBox(
        width: 360,
        child: QzBottomTabBar(currentIndex: 0, onTap: (_) {}),
      ),
      surfaceSize: const Size(360, 80),
    );

    final Finder bar = find.byType(QzBottomTabBar);
    final Finder clip = find
        .descendant(of: bar, matching: find.byType(ClipRect))
        .first;
    final Finder backdrop = find
        .descendant(of: clip, matching: find.byType(BackdropFilter))
        .first;
    final BackdropFilter widget = tester.widget<BackdropFilter>(backdrop);
    expect(widget.filter, isA<ImageFilter>());
    // Filter description on Flutter master/stable encodes sigma values; assert
    // non-zero blur applied rather than the identity filter.
    expect(widget.filter.toString(), contains('blur'));
  });

  testWidgets('active tab paints accentSoft pill behind icon', (tester) async {
    await pumpQz(
      tester,
      SizedBox(
        width: 360,
        child: QzBottomTabBar(currentIndex: 0, onTap: (_) {}),
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
