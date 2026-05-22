import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/auth/session_controller.dart';
import 'package:quantify_mobile/data/mock/mock_account_repository.dart';
import 'package:quantify_mobile/data/mock/mock_api_key_repository.dart';
import 'package:quantify_mobile/data/mock/mock_auth_repository.dart';
import 'package:quantify_mobile/data/models/auth_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/storage/secure_token_storage.dart';
import 'package:quantify_mobile/pages/me/me_home_page.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _LoginPlaceholder extends StatelessWidget {
  const _LoginPlaceholder();
  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: Text('LOGIN_PLACEHOLDER')));
}

Future<ProviderContainer> _pumpMe(
  WidgetTester tester, {
  AuthSession? initialSession,
  QzTheme theme = QzTheme.fallback,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 1600));
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  final InMemoryTokenStorage storage = InMemoryTokenStorage(
    initialSession == null
        ? null
        : <String, String>{
            kSessionStorageKey:
                '{"userId":"${initialSession.userId}","token":"${initialSession.token}","email":"${initialSession.email}"}',
          },
  );

  final ProviderContainer container = ProviderContainer(
    overrides: <Override>[
      sharedPreferencesProvider.overrideWithValue(prefs),
      tokenStorageProvider.overrideWithValue(storage),
      authRepositoryProvider.overrideWithValue(MockAuthRepository()),
      accountRepositoryProvider.overrideWithValue(MockAccountRepository()),
      apiKeyRepositoryProvider.overrideWithValue(MockApiKeyRepository()),
    ],
  );
  // M6 修复：每个 testWidgets 结束 dispose 容器（9 主题循环防止 9 个容器泄漏）。
  addTearDown(container.dispose);
  await container.read(sessionControllerProvider.future);

  final ValueNotifier<int> refresh = ValueNotifier<int>(0);
  container.listen<AsyncValue<AuthSession?>>(
    sessionControllerProvider,
    (AsyncValue<AuthSession?>? prev, AsyncValue<AuthSession?> next) =>
        refresh.value++,
  );

  final GoRouter router = GoRouter(
    initialLocation: '/me',
    refreshListenable: refresh,
    redirect: (BuildContext context, GoRouterState state) {
      final bool loggedIn =
          container.read(sessionControllerProvider).valueOrNull != null;
      final String loc = state.matchedLocation;
      if (!loggedIn && loc.startsWith('/me')) return '/login';
      return null;
    },
    routes: <RouteBase>[
      GoRoute(
        path: '/me',
        builder: (BuildContext context, GoRouterState state) =>
            const MeHomePage(),
      ),
      GoRoute(
        path: '/login',
        builder: (BuildContext context, GoRouterState state) =>
            const _LoginPlaceholder(),
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
        theme: buildQzThemeData(theme),
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return container;
}

void main() {
  const AuthSession kSession = AuthSession(
    userId: 'u',
    token: 't',
    email: 'me@quantify.dev',
  );

  testWidgets('渲染 header + 分组 + 退出登录按钮', (WidgetTester tester) async {
    await _pumpMe(tester, initialSession: kSession);
    // header 显示脱敏邮箱
    expect(find.text('vi***@gmail.com'), findsOneWidget);
    // UID（来自 mockAccountInfo）
    expect(find.text('cmp42glf60001yxqs0ivc09ff'), findsWidgets);
    // sections
    expect(find.text('账户'), findsOneWidget);
    expect(find.text('交易所 API'), findsOneWidget);
    expect(find.text('偏好'), findsOneWidget);
    // 退出按钮
    expect(find.text('退出登录'), findsOneWidget);
  });

  testWidgets('「我的」首页内联展开三家交易所 API（多行 + 管理/连接）',
      (WidgetTester tester) async {
    await _pumpMe(tester, initialSession: kSession);
    // 多行槽位（每家一行 + 状态 + 按钮）
    expect(find.text('Binance'), findsOneWidget);
    expect(find.text('OKX'), findsOneWidget);
    expect(find.text('Hyperliquid'), findsOneWidget);
    // mock_api_keys fixture 默认 Binance / OKX 已配置 → 「管理」x2 + 「连接」x1
    expect(find.text('管理'), findsNWidgets(2));
    expect(find.text('连接'), findsOneWidget);
  });

  testWidgets(
      '点击「连接」(Hyperliquid 未配置) 打开 api_form_sheet 并预填该交易所',
      (WidgetTester tester) async {
    await _pumpMe(tester, initialSession: kSession);
    // Hyperliquid 默认未配置 → 行尾按钮为「连接」
    await tester.tap(find.text('连接'));
    await tester.pumpAndSettle();
    // sheet 标题里包含「Hyperliquid API」（_ExchangeBadge 旁标题文案）
    expect(find.text('Hyperliquid API'), findsOneWidget);
  });

  testWidgets('统计卡主字段为活跃策略 / 累计收益 / 胜率', (WidgetTester tester) async {
    await _pumpMe(tester, initialSession: kSession);
    expect(find.text('活跃策略'), findsOneWidget);
    expect(find.text('累计收益'), findsOneWidget);
    expect(find.text('胜率'), findsOneWidget);
  });

  testWidgets('header 显示 Telegram 已绑定 chip', (WidgetTester tester) async {
    await _pumpMe(tester, initialSession: kSession);
    expect(find.text('Telegram 已绑定'), findsOneWidget);
  });

  testWidgets('UID 复制按钮点击 → Clipboard.setData(uid) + SnackBar',
      (WidgetTester tester) async {
    // Clipboard mock：记录调用
    final List<MethodCall> clipboardCalls = <MethodCall>[];
    tester.binding.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform,
            (MethodCall call) async {
      if (call.method == 'Clipboard.setData') {
        clipboardCalls.add(call);
      }
      return null;
    });
    await _pumpMe(tester, initialSession: kSession);
    // header 内 IconButton + Icons.copy
    final Finder copyBtn = find.byIcon(Icons.copy);
    expect(copyBtn, findsOneWidget);
    await tester.tap(copyBtn);
    await tester.pump();
    expect(clipboardCalls, hasLength(1));
    expect(
      (clipboardCalls.single.arguments as Map<dynamic, dynamic>)['text'],
      'cmp42glf60001yxqs0ivc09ff',
    );
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('UID 已复制'), findsOneWidget);
    await tester.pump(const Duration(seconds: 3));
  });

  testWidgets('退出登录 → session 清零，自动跳 /login',
      (WidgetTester tester) async {
    final ProviderContainer container =
        await _pumpMe(tester, initialSession: kSession);
    // 触发退出
    await tester.tap(find.text('退出登录'));
    await tester.pumpAndSettle();
    // session 已被清零
    expect(
      container.read(sessionControllerProvider).valueOrNull,
      isNull,
    );
    // router redirect 把我们从 /me 推到 /login
    expect(find.text('LOGIN_PLACEHOLDER'), findsOneWidget);
  });

  testWidgets('9 主题循环 pump 不抛异常', (WidgetTester tester) async {
    // 自保护：QzBg×QzAccent 真的是 9 种
    expect(
      QzBg.values.length * QzAccent.values.length,
      9,
      reason:
          '主题枚举数量变了，更新 me_home_page_test',
    );
    for (final QzBg bg in QzBg.values) {
      for (final QzAccent acc in QzAccent.values) {
        await _pumpMe(
          tester,
          initialSession: kSession,
          theme: QzTheme(bg: bg, accent: acc),
        );
        expect(tester.takeException(), isNull);
      }
    }
  });
}
