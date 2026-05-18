import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_kline_placeholder.dart';
import 'package:quantify_mobile/widgets/qz_segmented_tabs.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzKlinePlaceholder 渲染占位文案和 6 个周期', (WidgetTester tester) async {
    String value = '1m';
    await pumpQz(
      tester,
      QzKlinePlaceholder(
        value: value,
        onChanged: (String next) => value = next,
      ),
      surfaceSize: const Size(420, 520),
    );

    expect(find.text('K 线开发中'), findsOneWidget);
    expect(find.byType(QzSegmentedTabs), findsOneWidget);
    for (final String option in QzKlinePlaceholder.intervals) {
      expect(find.text(option), findsOneWidget);
    }

    await tester.tap(find.text('5m'));
    await tester.pump();
    expect(value, '5m');
  });
}
