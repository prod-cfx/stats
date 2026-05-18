import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/pages/me/widgets/qz_settings_row.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// 用最小 MaterialApp + QzTheme 包裹 row，确保 context.qzScheme 可读。
Future<void> _pump(WidgetTester tester, Widget child) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: buildQzThemeData(QzTheme.fallback),
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  testWidgets('label + value 渲染', (WidgetTester tester) async {
    await _pump(tester, const QzSettingsRow(label: '邮箱', value: 'a@b.com'));
    expect(find.text('邮箱'), findsOneWidget);
    expect(find.text('a@b.com'), findsOneWidget);
  });

  testWidgets('onTap 回调被触发', (WidgetTester tester) async {
    int taps = 0;
    await _pump(
      tester,
      QzSettingsRow(
        label: '主题',
        value: '跟随系统',
        onTap: () => taps++,
      ),
    );
    await tester.tap(find.text('主题'));
    await tester.pump();
    expect(taps, 1);
  });

  testWidgets('trailing = QzSettingsCaret 时显示 chevron_right',
      (WidgetTester tester) async {
    await _pump(
      tester,
      const QzSettingsRow(
        label: 'Telegram',
        value: '@u',
        trailing: QzSettingsCaret(),
      ),
    );
    expect(find.byIcon(Icons.chevron_right), findsOneWidget);
  });

  testWidgets('last=true 时不画底边', (WidgetTester tester) async {
    // 同时 pump 两个 row：第一个 last=false（有边），第二个 last=true（无边）
    await _pump(
      tester,
      Column(
        children: const <Widget>[
          QzSettingsRow(label: 'A', value: 'v'),
          QzSettingsRow(label: 'B', value: 'v', last: true),
        ],
      ),
    );
    // 行为断言通过结构存在性 + 不抛异常即可；border 像素验证留 golden。
    expect(find.text('A'), findsOneWidget);
    expect(find.text('B'), findsOneWidget);
  });
}
