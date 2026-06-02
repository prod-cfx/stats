import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_step_bar.dart';

const List<String> _steps = <String>['确认策略', '策略脚本', '回测设置', '回测', '部署'];

Future<void> _pump(
  WidgetTester tester,
  Widget child,
) async {
  await tester.binding.setSurfaceSize(const Size(420, 200));
  await tester.pumpWidget(
    MaterialApp(
      theme: buildQzThemeData(
        const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
      ),
      home: Scaffold(body: child),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('渲染全部 5 步标签', (WidgetTester tester) async {
    await _pump(tester, const QzStepBar(steps: _steps, active: 0));
    for (final String label in _steps) {
      expect(find.text(label), findsOneWidget);
    }
  });

  testWidgets('done 步显示对勾，active 步显示序号', (WidgetTester tester) async {
    await _pump(
      tester,
      const QzStepBar(steps: _steps, active: 2, done: <int>[0, 1]),
    );
    // 两个 done 步 → 两个对勾。
    expect(find.byIcon(Icons.check_rounded), findsNWidgets(2));
    // active 步序号仍以 0N 形式展示。
    expect(find.text('03'), findsOneWidget);
    // done 步序号被对勾替换，不再渲染。
    expect(find.text('01'), findsNothing);
    expect(find.text('02'), findsNothing);
  });

  testWidgets('点击 done 步触发回调，点击非 done 步不触发', (WidgetTester tester) async {
    final List<int> tapped = <int>[];
    await _pump(
      tester,
      QzStepBar(
        steps: _steps,
        active: 2,
        done: const <int>[0, 1],
        onStepTap: tapped.add,
      ),
    );

    await tester.tap(find.text('确认策略'));
    await tester.tap(find.text('回测设置')); // active，非 done
    await tester.tap(find.text('部署')); // 未达成
    await tester.pump();

    expect(tapped, <int>[0]);
  });

  testWidgets('done 为空时无对勾', (WidgetTester tester) async {
    await _pump(tester, const QzStepBar(steps: _steps, active: 0));
    expect(find.byIcon(Icons.check_rounded), findsNothing);
    expect(find.text('01'), findsOneWidget);
  });
}
