import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_backtest_progress_card.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('renders title, percent and progress across 9 themes',
      (WidgetTester tester) async {
    await verifyAllThemes(
      tester,
      () => const QzBacktestProgressCard(progress: 0.42),
      (WidgetTester t) async {
        expect(find.text('回测进行中'), findsOneWidget);
        expect(find.byKey(const Key('backtest-progress-percent')), findsOneWidget);
        expect(find.text('42%'), findsOneWidget);
        expect(find.byKey(const Key('backtest-progress-bar')), findsOneWidget);
      },
      surfaceSize: const Size(360, 200),
    );
  });

  testWidgets('clamps out-of-range progress to 0..100', (WidgetTester tester) async {
    await pumpQz(
      tester,
      const QzBacktestProgressCard(progress: 1.6),
      surfaceSize: const Size(360, 200),
    );
    expect(find.text('100%'), findsOneWidget);
  });

  testWidgets('hides cancel button when onCancel is null',
      (WidgetTester tester) async {
    await pumpQz(
      tester,
      const QzBacktestProgressCard(progress: 0.1),
      surfaceSize: const Size(360, 200),
    );
    expect(find.byKey(const Key('backtest-progress-cancel')), findsNothing);
  });

  testWidgets('tapping cancel invokes onCancel', (WidgetTester tester) async {
    int taps = 0;
    await pumpQz(
      tester,
      QzBacktestProgressCard(progress: 0.5, onCancel: () => taps++),
      surfaceSize: const Size(360, 200),
    );
    await tester.tap(find.byKey(const Key('backtest-progress-cancel')));
    await tester.pump();
    expect(taps, 1);
  });
}
