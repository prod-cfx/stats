import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_sheet.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzSheet golden baseline (light+violet, after open)',
      (tester) async {
    await pumpQz(
      tester,
      Builder(builder: (ctx) {
        return Center(
          child: ElevatedButton(
            onPressed: () => QzSheet.show<void>(
              context: ctx,
              builder: (_) => const SizedBox(
                height: 160,
                child: Center(child: Text('Sheet body')),
              ),
            ),
            child: const Text('open'),
          ),
        );
      }),
      surfaceSize: const Size(360, 480),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await expectLater(
      find.text('Sheet body'),
      findsOneWidget,
    );
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/qz_sheet.png'),
    );
  });

  testWidgets('QzSheet opens under 9 themes', (tester) async {
    // We only need to assert the sheet builder runs without throwing on each
    // theme. Tapping a button + pumpAndSettle 9 times in a row triggers
    // overlay state that pumpQz()'s single-frame rebuild can't fully reset,
    // so we drive QzSheet.show via a state callback inside pumpQz instead.
    await verifyAllThemes(
      tester,
      () => Builder(
        builder: (ctx) => Center(
          child: TextButton(
            onPressed: () => QzSheet.show<void>(
              context: ctx,
              builder: (_) => const SizedBox(
                height: 80,
                child: Center(child: Text('Inner')),
              ),
            ),
            child: const Text('open'),
          ),
        ),
      ),
      (t) async {
        // Tap to open; if QzSheet build throws under any theme, takeException
        // (asserted by verifyAllThemes) will catch it.
        await t.tap(find.text('open'));
        await t.pump(); // start route push
        await t.pump(const Duration(milliseconds: 400)); // finish animation
      },
      surfaceSize: const Size(360, 480),
    );
  });
}
