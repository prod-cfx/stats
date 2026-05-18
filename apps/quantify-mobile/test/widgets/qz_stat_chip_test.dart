import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_stat_chip.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzStatChip golden baseline (light+violet, +/-/zero)',
      (tester) async {
    await pumpQz(
      tester,
      const Row(
        key: ValueKey<String>('qz_stat_chip_golden'),
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          QzStatChip(value: 0.0123),
          SizedBox(width: 8),
          QzStatChip(value: -0.0421),
          SizedBox(width: 8),
          QzStatChip(value: 0),
        ],
      ),
      surfaceSize: const Size(360, 80),
    );
    await expectLater(
      find.byKey(const ValueKey<String>('qz_stat_chip_golden')),
      matchesGoldenFile('goldens/qz_stat_chip.png'),
    );
  });

  testWidgets('QzStatChip formats sign + decimals', (tester) async {
    await pumpQz(
      tester,
      const Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          QzStatChip(value: 0.05),
          SizedBox(width: 8),
          // Use a value whose %·100 has < 3 decimal digits to dodge IEEE 754
          // banker's-rounding flakiness on the half-step boundary.
          QzStatChip(value: -0.1013),
          SizedBox(width: 8),
          QzStatChip(value: 0),
        ],
      ),
    );
    expect(find.text('+5.00%'), findsOneWidget);
    expect(find.text('-10.13%'), findsOneWidget);
    expect(find.text('0.00%'), findsOneWidget);
  });

  testWidgets('QzStatChip renders "--" placeholder for NaN / Infinity',
      (tester) async {
    await pumpQz(
      tester,
      const Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          QzStatChip(value: double.nan),
          SizedBox(width: 8),
          QzStatChip(value: double.infinity),
          SizedBox(width: 8),
          QzStatChip(value: double.negativeInfinity),
        ],
      ),
    );
    expect(find.text('--'), findsNWidgets(3));
    expect(find.text('NaN%'), findsNothing);
    expect(find.textContaining('Infinity'), findsNothing);
  });

  testWidgets('QzStatChip renders cleanly under 9 themes', (tester) async {
    await verifyAllThemes(
      tester,
      () => const QzStatChip(value: 0.0123),
      (t) async {
        expect(find.text('+1.23%'), findsOneWidget);
      },
    );
  });
}
