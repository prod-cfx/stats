import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_chip.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzChip golden baseline (light+violet, all tones)',
      (tester) async {
    await pumpQz(
      tester,
      const Wrap(
        spacing: 6,
        runSpacing: 6,
        children: <Widget>[
          QzChip(label: 'Neutral'),
          QzChip(label: 'OK', tone: QzChipTone.ok),
          QzChip(label: 'Warn', tone: QzChipTone.warn),
          QzChip(label: 'Danger', tone: QzChipTone.danger),
          QzChip(label: 'Info', tone: QzChipTone.info),
          QzChip(label: 'Accent', tone: QzChipTone.accent),
          QzChip(label: 'Inverse', tone: QzChipTone.inverse),
        ],
      ),
      surfaceSize: const Size(360, 160),
    );
    await expectLater(
      find.byType(Wrap),
      matchesGoldenFile('goldens/qz_chip.png'),
    );
  });

  testWidgets('QzChip renders cleanly under 9 themes', (tester) async {
    await verifyAllThemes(
      tester,
      () => const QzChip(label: 'Tag', tone: QzChipTone.accent),
      (t) async {
        expect(find.text('Tag'), findsOneWidget);
      },
    );
  });
}
