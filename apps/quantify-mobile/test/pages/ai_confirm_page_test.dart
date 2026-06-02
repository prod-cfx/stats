import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/ai/ai_confirm_page.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_step_bar.dart';

Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(420, 1600));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(
        const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
      ),
      home: const AiConfirmPage(),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('确认策略 fallback market chip 默认合约 5x（#2066）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    expect(find.text('合约 · 5x'), findsOneWidget);
    expect(find.text('合约 · 1x'), findsNothing);
  });

  testWidgets('确认页顶栏下方展示 5 步流程条（#2130）', (WidgetTester tester) async {
    await _pump(tester);

    final Finder stepBar = find.byKey(const Key('qz-step-bar'));
    expect(stepBar, findsOneWidget);

    // 5 步标签按设计稿顺序展示（标签在流程条作用域内唯一）。
    for (final String label in <String>[
      '策略脚本',
      '回测设置',
      '回测',
      '部署',
    ]) {
      expect(
        find.descendant(of: stepBar, matching: find.text(label)),
        findsOneWidget,
      );
    }
    // 「确认策略」同时出现在顶栏标题与流程条，限定流程条内仍唯一。
    expect(
      find.descendant(of: stepBar, matching: find.text('确认策略')),
      findsOneWidget,
    );
  });

  testWidgets('确认页流程条 active=0 done 为空（#2130）', (WidgetTester tester) async {
    await _pump(tester);
    final QzStepBar bar = tester.widget<QzStepBar>(find.byType(QzStepBar));
    expect(bar.active, 0);
    expect(bar.done, isEmpty);
    // done 为空 → 无对勾图标。
    expect(
      find.descendant(
        of: find.byType(QzStepBar),
        matching: find.byIcon(Icons.check_rounded),
      ),
      findsNothing,
    );
  });
}
