import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_search_bar.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzSearchBar golden baseline (light+violet)', (tester) async {
    await pumpQz(
      tester,
      const SizedBox(
        width: 280,
        child: QzSearchBar(hint: 'Search coins'),
      ),
    );
    await expectLater(
      find.byType(QzSearchBar),
      matchesGoldenFile('goldens/qz_search_bar.png'),
    );
  });

  testWidgets('QzSearchBar renders cleanly under 9 themes', (tester) async {
    await verifyAllThemes(
      tester,
      () => const SizedBox(
        width: 280,
        child: QzSearchBar(hint: 'Search'),
      ),
      (t) async {
        expect(find.byIcon(Icons.search), findsOneWidget);
      },
    );
  });

  testWidgets('QzSearchBar onChanged emits the entered text', (tester) async {
    // Note: `tester.enterText` commits the whole string in a single
    // platform message, so `onChanged` fires once with the final value —
    // not per keystroke. This still verifies the binding is wired through
    // to the underlying TextField.
    final List<String> events = <String>[];
    await pumpQz(
      tester,
      SizedBox(
        width: 280,
        child: QzSearchBar(onChanged: events.add),
      ),
    );
    await tester.enterText(find.byType(TextField), 'btc');
    expect(events, <String>['btc']);
  });
}
