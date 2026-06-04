import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/me/theme_settings_page.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_top_bar.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<ProviderContainer> _pumpTheme(
  WidgetTester tester, {
  GoRouter? router,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 2000));
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  final ProviderContainer container = ProviderContainer(
    overrides: <Override>[
      sharedPreferencesProvider.overrideWithValue(prefs),
    ],
  );
  addTearDown(container.dispose);
  final GoRouter effectiveRouter = router ??
      GoRouter(
        initialLocation: '/me/theme',
        routes: <RouteBase>[
          GoRoute(
            path: '/me/theme',
            builder: (BuildContext context, GoRouterState state) =>
                const ThemeSettingsPage(),
          ),
        ],
      );
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(QzTheme.fallback),
        routerConfig: effectiveRouter,
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

  testWidgets('顶栏使用 QzTopBar，标题/副标题对齐设计稿',
      (WidgetTester tester) async {
    await _pumpTheme(tester);
    expect(find.byType(QzTopBar), findsOneWidget);
    expect(find.text('界面主题'), findsOneWidget);
    expect(find.text('此设置会同步到 Web 和 App'), findsOneWidget);
  });

  testWidgets('顶栏右侧展示 palette 圆形徽章',
      (WidgetTester tester) async {
    await _pumpTheme(tester);
    expect(
      find.byKey(const ValueKey<String>('themeTopBarPaletteBadge')),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.palette_outlined), findsOneWidget);
  });

  testWidgets('底部同步说明改为本地持久化文案，避免误导账号跨端同步',
      (WidgetTester tester) async {
    await _pumpTheme(tester);
    expect(
      find.text('当前主题仅保存在本设备；接入账号同步后，将在 Web 与 App 之间随登录自动应用。'),
      findsOneWidget,
    );
    // 旧账号同步误导文案不应再存在
    expect(
      find.text('主题在 Web 与 App 之间通过你的账号同步，下次登录会自动应用。'),
      findsNothing,
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
    // Design default is reduceMotion=true; one tap flips it off.
    expect(container.read(themeProvider).reduceMotion, isTrue);
    await tester
        .tap(find.byKey(const ValueKey<String>('themeToggleReduceMotion')));
    await tester.pumpAndSettle();
    expect(container.read(themeProvider).reduceMotion, isFalse);
  });
}
