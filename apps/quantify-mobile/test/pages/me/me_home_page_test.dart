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
import 'package:quantify_mobile/data/models/live_strategy_models.dart';
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
  LiveStrategySummary summary = const LiveStrategySummary(
    totalAssets: 0,
    totalCapital: 0,
    todayPnl: 0,
    totalPnl: 0,
    runningCount: 2,
    warningCount: 1,
    pausedCount: 1,
    stoppedCount: 1,
  ),
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
      // 大卡计数（#1792 / #1816）直接喂确定值，避免 mock repo 的 200ms 延时
      // 在 widget 树 dispose 后留下 pending timer。
      liveStrategySummaryProvider.overrideWith((Ref ref) async => summary),
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
      GoRoute(
        path: '/me/live',
        builder: (BuildContext context, GoRouterState state) => const Scaffold(
          key: Key('live-stub'),
          body: Center(child: Text('LIVE_STUB')),
        ),
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

  testWidgets('实盘策略入口存在并可进入列表（#1752）', (WidgetTester tester) async {
    await _pumpMe(tester, initialSession: kSession);
    final Finder entry = find.byKey(const Key('me-live-strategies-entry'));
    expect(entry, findsOneWidget);
    await tester.ensureVisible(entry);
    await tester.tap(entry);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('live-stub')), findsOneWidget);
  });

  testWidgets('实盘策略入口为 header 下首位大卡（账户分组之前）（#1792）',
      (WidgetTester tester) async {
    await _pumpMe(tester, initialSession: kSession);
    final Finder entry = find.byKey(const Key('me-live-strategies-entry'));
    expect(entry, findsOneWidget);
    // 大卡的「实盘策略」标题需位于「账户」分组标题之前（更靠上）。
    final double entryY = tester.getTopLeft(entry).dy;
    final double accountY = tester.getTopLeft(find.text('账户')).dy;
    expect(entryY, lessThan(accountY),
        reason: '实盘策略入口应在账户分组之前');
  });

  testWidgets('实盘策略大卡展示运行中策略计数（#1792）',
      (WidgetTester tester) async {
    await _pumpMe(tester, initialSession: kSession);
    // fixture 含 2 个 running 策略 → 「2 运行中」。
    expect(find.text('2 运行中'), findsOneWidget);
  });

  testWidgets('标题文案对齐设计稿「查看实盘策略」（#1816）',
      (WidgetTester tester) async {
    await _pumpMe(tester, initialSession: kSession);
    // 限定在入口卡内（避免与他处同名文案撞车）。
    expect(
      find.descendant(
        of: find.byKey(const Key('me-live-strategies-entry')),
        matching: find.text('查看实盘策略'),
      ),
      findsOneWidget,
    );
  });

  testWidgets('标题旁渲染活跃计数 badge（非 stopped 总数）（#1816）',
      (WidgetTester tester) async {
    await _pumpMe(tester, initialSession: kSession);
    // active = running 2 + warning 1 + paused 1 = 4（stopped 不计）。
    expect(find.text('4'), findsOneWidget);
  });

  testWidgets('多状态明细行按顺序展示且 0 计数不渲染（#1816）',
      (WidgetTester tester) async {
    await _pumpMe(
      tester,
      initialSession: kSession,
      summary: const LiveStrategySummary(
        totalAssets: 0,
        totalCapital: 0,
        todayPnl: 0,
        totalPnl: 0,
        runningCount: 3,
        warningCount: 2,
        pausedCount: 0,
        stoppedCount: 1,
      ),
    );
    expect(find.text('3 运行中'), findsOneWidget);
    expect(find.text('2 需关注'), findsOneWidget);
    // pausedCount=0 → 不渲染。
    expect(find.textContaining('已暂停'), findsNothing);
    expect(find.text('1 已停止'), findsOneWidget);
    // badge active = 3 + 2 + 0 = 5。
    expect(find.text('5'), findsOneWidget);
  });

  testWidgets('全 0 计数退化为副标题且整卡仍可点进入 /me/live（#1816）',
      (WidgetTester tester) async {
    await _pumpMe(
      tester,
      initialSession: kSession,
      summary: const LiveStrategySummary(
        totalAssets: 0,
        totalCapital: 0,
        todayPnl: 0,
        totalPnl: 0,
        runningCount: 0,
        warningCount: 0,
        pausedCount: 0,
        stoppedCount: 0,
      ),
    );
    expect(find.text('查看运行状态、持仓与收益'), findsOneWidget);
    // badge 显示 0，整卡可点。
    expect(find.text('0'), findsWidgets);
    final Finder entry = find.byKey(const Key('me-live-strategies-entry'));
    await tester.ensureVisible(entry);
    await tester.tap(entry);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('live-stub')), findsOneWidget);
  });

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

  testWidgets('账户分组 Telegram 行显示 handle、安全行显示双重认证状态',
      (WidgetTester tester) async {
    await _pumpMe(tester, initialSession: kSession);
    // 对齐设计稿 m-screens-4.jsx:1009-1010
    expect(find.text('@victor_qf'), findsOneWidget);
    expect(find.text('双重认证 · 已开启'), findsOneWidget);
    // 「查看」仅推送通知行残留一处，安全行不再退化（共 1 次）
    expect(find.text('查看'), findsOneWidget);
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
