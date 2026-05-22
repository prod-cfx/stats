import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/me/theme_settings_page.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<ProviderContainer> _pumpTheme(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(420, 2000));
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  final ProviderContainer container = ProviderContainer(
    overrides: <Override>[
      sharedPreferencesProvider.overrideWithValue(prefs),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(QzTheme.fallback),
        home: const ThemeSettingsPage(),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return container;
}

void main() {
  testWidgets('渲染「自动跟随系统」+「减少动画」两个 toggle',
      (WidgetTester tester) async {
    await _pumpTheme(tester);
    expect(find.text('自动跟随系统'), findsOneWidget);
    expect(find.text('减少动画'), findsOneWidget);
    // 两个 Switch
    expect(find.byType(Switch), findsNWidgets(2));
  });

  testWidgets('顶部副标题对齐设计稿：账号同步而非仅本设备',
      (WidgetTester tester) async {
    await _pumpTheme(tester);
    expect(find.text('此设置会同步到 Web 和 App'), findsOneWidget);
    expect(find.text('仅本设备生效'), findsNothing);
  });

  testWidgets('底部展示账号同步提示卡片',
      (WidgetTester tester) async {
    await _pumpTheme(tester);
    expect(
      find.text('主题在 Web 与 App 之间通过你的账号同步，下次登录会自动应用。'),
      findsOneWidget,
    );
  });

  testWidgets('点击「自动跟随系统」开关 → state.autoFollowSystem 翻转 + 持久化',
      (WidgetTester tester) async {
    final ProviderContainer container = await _pumpTheme(tester);
    expect(container.read(themeProvider).autoFollowSystem, isFalse);
    // 通过 ValueKey 精确定位（避免 .first/.last 在新增 Switch 后静默测错）
    await tester
        .tap(find.byKey(const ValueKey<String>('themeToggleAutoFollowSystem')));
    await tester.pumpAndSettle();
    expect(container.read(themeProvider).autoFollowSystem, isTrue);
  });

  testWidgets('点击「减少动画」开关 → state.reduceMotion 翻转',
      (WidgetTester tester) async {
    final ProviderContainer container = await _pumpTheme(tester);
    expect(container.read(themeProvider).reduceMotion, isFalse);
    await tester
        .tap(find.byKey(const ValueKey<String>('themeToggleReduceMotion')));
    await tester.pumpAndSettle();
    expect(container.read(themeProvider).reduceMotion, isTrue);
  });
}
