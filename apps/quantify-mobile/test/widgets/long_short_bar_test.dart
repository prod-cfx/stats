import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/pages/market/widgets/long_short_bar.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('LongShortBar renders both ratios as percentages', (
    tester,
  ) async {
    await pumpQz(
      tester,
      const LongShortBar(longRatio: 0.58, shortRatio: 0.42),
      surfaceSize: const Size(360, 80),
    );
    expect(find.text('58.00%'), findsOneWidget);
    expect(find.text('42.00%'), findsOneWidget);
  });

  testWidgets('LongShortBar long=NaN falls back to neutral 50/50', (
    tester,
  ) async {
    await pumpQz(
      tester,
      const LongShortBar(longRatio: double.nan, shortRatio: 0.4),
      surfaceSize: const Size(360, 80),
    );
    // Both segments must show 50.0% — not 33.3%/66.7% which would happen
    // if only the NaN side was reset to 0.5 then renormalised against 0.4.
    expect(find.text('50.00%'), findsNWidgets(2));
  });

  testWidgets('LongShortBar short=Infinity falls back to neutral 50/50', (
    tester,
  ) async {
    await pumpQz(
      tester,
      const LongShortBar(longRatio: 0.6, shortRatio: double.infinity),
      surfaceSize: const Size(360, 80),
    );
    expect(find.text('50.00%'), findsNWidgets(2));
  });

  testWidgets('LongShortBar clamps out-of-range values', (tester) async {
    await pumpQz(
      tester,
      const LongShortBar(longRatio: 2.0, shortRatio: -1.0),
      surfaceSize: const Size(360, 80),
    );
    // long clamped to 1.0, short clamped to 0.0 → renders 100% / 0%.
    expect(find.text('100.00%'), findsOneWidget);
    expect(find.text('0.00%'), findsOneWidget);
  });

  testWidgets('LongShortBar both zero falls back to neutral 50/50', (
    tester,
  ) async {
    await pumpQz(
      tester,
      const LongShortBar(longRatio: 0.0, shortRatio: 0.0),
      surfaceSize: const Size(360, 80),
    );
    expect(find.text('50.00%'), findsNWidgets(2));
  });

  testWidgets('LongShortBar renormalises when sum != 1', (tester) async {
    // 0.3 + 0.6 = 0.9 → expected 33.3% / 66.7% after normalisation.
    await pumpQz(
      tester,
      const LongShortBar(longRatio: 0.3, shortRatio: 0.6),
      surfaceSize: const Size(360, 80),
    );
    expect(find.text('33.33%'), findsOneWidget);
    expect(find.text('66.67%'), findsOneWidget);
  });
}
