import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/fixtures/backtest.dart';
import 'package:quantify_mobile/widgets/qz_backtest_result_card.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('positive return card renders across 9 themes',
      (WidgetTester tester) async {
    await verifyAllThemes(
      tester,
      () => const QzBacktestResultCard(result: mockBacktestResult),
      (WidgetTester t) async {
        expect(find.text('回测结果'), findsOneWidget);
        expect(find.text('+18.20%'), findsOneWidget);
        expect(find.text('-7.50%'), findsOneWidget);
        expect(find.text('1.32'), findsOneWidget);
        expect(find.text('42 笔'), findsOneWidget);
      },
      surfaceSize: const Size(360, 280),
    );
  });
}
