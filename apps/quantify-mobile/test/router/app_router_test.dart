import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/auth/session_controller.dart';
import 'package:quantify_mobile/data/mock/fixtures/account.dart';
import 'package:quantify_mobile/data/mock/fixtures/api_key.dart';
import 'package:quantify_mobile/data/mock/mock_auth_repository.dart';
import 'package:quantify_mobile/data/models/api_key_models.dart';
import 'package:quantify_mobile/data/models/auth_models.dart';
import 'package:quantify_mobile/data/models/kline_models.dart';
import 'package:quantify_mobile/domain/models/live_strategy_models.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/kline_repository.dart';
import 'package:quantify_mobile/data/repositories/ticker_repository.dart';
import 'package:quantify_mobile/data/storage/secure_token_storage.dart';
import 'package:quantify_mobile/main.dart';
import 'package:quantify_mobile/pages/_dev/components_preview_page.dart';
import 'package:quantify_mobile/pages/_dev/theme_preview_page.dart';
import 'package:quantify_mobile/pages/ai/ai_confirm_page.dart';
import 'package:quantify_mobile/pages/ai/ai_backtest_result_page.dart';
import 'package:quantify_mobile/pages/ai/ai_backtest_run_page.dart';
import 'package:quantify_mobile/pages/ai/ai_deploy_page.dart';
import 'package:quantify_mobile/pages/ai/ai_home_page.dart';
import 'package:quantify_mobile/pages/ai/backtest_config_sheet.dart';
import 'package:quantify_mobile/pages/auth/login_sheet.dart';
import 'package:quantify_mobile/pages/market/data_hub_page.dart';
import 'package:quantify_mobile/pages/market/market_detail_page.dart';
import 'package:quantify_mobile/pages/market/widgets/data_hub_header.dart';
import 'package:quantify_mobile/pages/live/live_strategies_page.dart';
import 'package:quantify_mobile/pages/me/me_home_page.dart';
import 'package:quantify_mobile/pages/me/theme_settings_page.dart';
import 'package:quantify_mobile/pages/strategy/strategy_home_page.dart';
import 'package:quantify_mobile/pages/strategy/strategy_guest_page.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_live_tab_controller.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_live_tab_state.dart';
import 'package:quantify_mobile/pages/whale/whale_home_page.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Pumps the app and navigates to `/ai` to bypass the debug-only landing
/// (`/_dev/theme-preview`). Returns a [BuildContext] anchored on the AI page.
/// 路由测试用无计时器假行情仓库：`watchTicker` 返回空流，避免真实
/// `MockTickerRepository.Stream.periodic`（1s）在 widget dispose 后残留计时器
/// 触发 `!timersPending`（同 #1838 对 account/apiKeys 的处理思路）。
class _NoTimerTickerRepository implements TickerRepository {
  static const Ticker _btc = Ticker(
    symbol: 'BTCUSDT',
    price: 100,
    changePercent: 1,
    volume24h: 10,
  );

  @override
  Future<List<Ticker>> listTickers() async => const <Ticker>[_btc];

  @override
  Stream<Ticker> watchTicker(String symbol) => const Stream<Ticker>.empty();
}

/// 同上：`watchCandles` 返回空流，消除 K 线 periodic 计时器。
class _NoTimerKlineRepository implements KlineRepository {
  @override
  Future<List<Candle>> listCandles({
    required String symbol,
    required KlineInterval interval,
    required int limit,
  }) async =>
      <Candle>[
        Candle(
          openTime: DateTime(2024),
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume: 1,
        ),
      ];

  @override
  Stream<Candle> watchCandles({
    required String symbol,
    required KlineInterval interval,
  }) =>
      const Stream<Candle>.empty();
}

/// whale 实时 tab 控制器在 `build()` 内启 1s periodic 倒计时（#1986）。路由测试
/// 切到 whale tab 时该 Timer 会被 StatefulShellRoute 保活，测试体结束仍 pending →
/// "A Timer is still pending"。路由测试只关心落地页类型，用不启计时器的子类覆盖。
class _NoTimerWhaleLiveTabController extends WhaleLiveTabController {
  @override
  WhaleLiveTabState build() => const WhaleLiveTabState();
}

Future<BuildContext> _pumpApp(
  WidgetTester tester, {
  InMemoryTokenStorage? storage,
}) async {
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  final InMemoryTokenStorage s = storage ?? InMemoryTokenStorage();
  final ProviderContainer container = ProviderContainer(
    overrides: <Override>[
      sharedPreferencesProvider.overrideWithValue(prefs),
      tokenStorageProvider.overrideWithValue(s),
      authRepositoryProvider.overrideWithValue(MockAuthRepository()),
      // `/market/:symbol` 落地 MarketDetailPage，其 #2184 controller 订阅
      // ticker/candle mock `Stream.periodic` 推流；用无计时器假仓库覆盖，避免
      // widget dispose 后残留 periodic 计时器（同 #1838 思路）。
      tickerRepositoryProvider.overrideWithValue(_NoTimerTickerRepository()),
      klineRepositoryProvider.overrideWithValue(_NoTimerKlineRepository()),
      // `/me` 落地 MeHomePage 会 watch account/apiKeys/liveStrategySummary，
      // 其 mock repo 各启 200ms `Future.delayed` 计时器；widget dispose 时
      // 该 timer 未排空 → "A Timer is still pending"（#1838）。路由测试只关心
      // 落地页类型，把这三个 future provider 覆盖为同步 fixture，消除挂起计时器。
      accountInfoProvider.overrideWith((Ref ref) async => mockAccountInfo),
      apiKeysProvider.overrideWith(
        (Ref ref) async => List<ExchangeApiKey>.unmodifiable(mockApiKeys),
      ),
      liveStrategySummaryProvider.overrideWith(
        (Ref ref) async => const LiveStrategySummary(
          totalAssets: 0,
          totalCapital: 0,
          todayPnl: 0,
          totalPnl: 0,
          runningCount: 0,
          warningCount: 0,
          pausedCount: 0,
          stoppedCount: 0,
        ),
      ),
      // whale tab 倒计时 1s periodic Timer 在路由测试中会残留为 pending；用不启
      // 计时器的子类覆盖（同 ticker/kline/me 的无计时器 fixture 思路）。
      whaleLiveTabControllerProvider.overrideWith(
        _NoTimerWhaleLiveTabController.new,
      ),
    ],
  );
  await container.read(sessionControllerProvider.future);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const QuantifyMobileApp(),
    ),
  );
  await tester.pumpAndSettle();
  // Default initial route is /strategy guest. Most router tests need a stable
  // tab page, so jump to /ai explicitly.
  final BuildContext bootCtx = tester.element(find.byType(Navigator).first);
  GoRouter.of(bootCtx).go('/ai');
  await tester.pumpAndSettle();
  return tester.element(find.byType(AiHomePage));
}

/// Locates a bottom-tab icon by stable ValueKey instead of icon constant —
/// keeps tests resilient against future icon swaps.
Finder _tab(String name) => find.byKey(ValueKey<String>('tab-$name'));

/// DataHub 内含无限循环的 QzPulseDot，切到 market 后不能用 pumpAndSettle。
Future<void> _pumpAfterTabTap(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 350));
  await tester.pump();
}

/// 构造一份已登录的 InMemoryTokenStorage，用来绕过 `/me*` 守卫。
InMemoryTokenStorage _loggedInStorage() {
  final AuthSession seed = AuthSession(
    userId: 'u',
    token: 't',
    email: 'a@b.com',
  );
  return InMemoryTokenStorage(<String, String>{
    kSessionStorageKey: jsonEncode(seed.toMap()),
  });
}

void main() {
  testWidgets('5 tabs render and switch via bottom bar', (
    WidgetTester tester,
  ) async {
    // /me 受守卫保护 → 需要预登录 session 才能切到 me tab。
    await _pumpApp(tester, storage: _loggedInStorage());
    expect(find.byType(AiHomePage), findsOneWidget);

    await tester.tap(_tab('market'));
    await _pumpAfterTabTap(tester);
    expect(find.byType(DataHubPage), findsOneWidget);

    await tester.tap(_tab('strategy'));
    await _pumpAfterTabTap(tester);
    expect(find.byType(StrategyHomePage), findsOneWidget);

    await tester.tap(_tab('whale'));
    await _pumpAfterTabTap(tester);
    expect(find.byType(WhaleHomePage), findsOneWidget);

    await tester.tap(_tab('me'));
    await _pumpAfterTabTap(tester);
    expect(find.byType(MeHomePage), findsOneWidget);
  });

  testWidgets(
    'bottom-bar index → page mapping is strategy/ai/market/whale/me',
    (WidgetTester tester) async {
      // Source-of-truth guard for issue #1637 / #1881: lock the router branch
      // order so reshuffling branches in `app_router.dart` (or tab order in
      // `QzBottomTabBar`) trips this test, not just runtime UX.
      await _pumpApp(tester, storage: _loggedInStorage());

      const List<String> keys = <String>[
        'tab-strategy',
        'tab-ai',
        'tab-market',
        'tab-whale',
        'tab-me',
      ];
      final List<Type> expectedPages = <Type>[
        StrategyHomePage,
        AiHomePage,
        DataHubPage,
        WhaleHomePage,
        MeHomePage,
      ];

      for (int i = 0; i < keys.length; i++) {
        await tester.tap(_tab(keys[i].substring('tab-'.length)));
        await _pumpAfterTabTap(tester);
        expect(
          find.byType(expectedPages[i]),
          findsOneWidget,
          reason:
              'tab index $i (key=${keys[i]}) must land on ${expectedPages[i]}',
        );
      }
    },
  );

  testWidgets('branch state is preserved across tab switch', (
    WidgetTester tester,
  ) async {
    await _pumpApp(tester);

    // AiHomePage 输入框草稿在 tab 切换时应被 IndexedStack 保留 — 通过
    // chat input 写入一段草稿，再来回切换，验证 branch state 不丢。
    final Finder input = find.byKey(const Key('ai-chat-input'));
    await tester.enterText(input, 'draft-preserve-1590');
    await tester.pump();
    expect(find.text('draft-preserve-1590'), findsOneWidget);

    // Switch to market and back; input draft should survive.
    await tester.tap(_tab('market'));
    await _pumpAfterTabTap(tester);
    expect(find.byType(DataHubPage), findsOneWidget);

    await tester.tap(_tab('ai'));
    await _pumpAfterTabTap(tester);
    expect(find.byType(AiHomePage), findsOneWidget);
    expect(find.text('draft-preserve-1590'), findsOneWidget);
  });

  testWidgets('tapping the active tab is safe (initialLocation path)', (
    WidgetTester tester,
  ) async {
    // Guards the `initialLocation: i == currentIndex` branch in
    // MainShellScaffold.onTap. Each tab branch currently holds a single
    // route, so re-tapping is a no-op visually — but the call must not
    // throw. Once a tab grows sub-routes (later PRs), this same test will
    // start asserting "pop to branch root" behavior.
    await _pumpApp(tester);
    expect(find.byType(AiHomePage), findsOneWidget);

    await tester.tap(_tab('ai'));
    await tester.pumpAndSettle();
    expect(find.byType(AiHomePage), findsOneWidget);

    await tester.tap(_tab('market'));
    await _pumpAfterTabTap(tester);
    await tester.tap(_tab('market')); // tap active tab
    await _pumpAfterTabTap(tester);
    expect(find.byType(DataHubPage), findsOneWidget);
  });

  test('/login route 已移除（issue #2075）', () {
    final String source = File('lib/router/app_router.dart').readAsStringSync();
    expect(source.contains("path: '/login'"), isFalse);
    expect(source.contains('LoginPage'), isFalse);
  });

  testWidgets('/market/long-short resolves to DataHubPage (not :symbol)', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/market/long-short');
    // 不用 pumpAndSettle：hub 内 MarketHomeBody 的 mock kline 流式 Timer 永不静默。
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));

    expect(find.byType(DataHubPage), findsOneWidget);
    expect(find.byType(MarketDetailPage), findsNothing);
    // 深链预选多空比 tab（#1853）。
    final DataHubPage page = tester.widget<DataHubPage>(
      find.byType(DataHubPage),
    );
    expect(page.initial, DataHubScreen.longShort);
  });

  testWidgets('/market/BTCUSDT resolves to MarketDetailPage', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/market/BTCUSDT');
    await tester.pumpAndSettle();

    expect(find.byType(MarketDetailPage), findsOneWidget);
    // MarketDetailPage 的 TopBar 标题经 #2109 改为 `BASE / QUOTE` 分隔格式
    // （见 market_detail_page.dart `_topBarTitle`：`'$base / $quote'`），
    // `BTCUSDT` 由 `splitSymbolAssets` 拆为 `BTC / USDT`，故断言对齐该文案。
    expect(find.text('BTC / USDT'), findsWidgets);
  });

  testWidgets('/ai/backtest-config resolves to BacktestConfigSheet', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/ai/backtest-config');
    await tester.pumpAndSettle();

    expect(find.byType(BacktestConfigSheet), findsOneWidget);
    expect(find.byKey(const Key('qz-step-bar')), findsOneWidget);
    expect(find.text('回测设置'), findsWidgets);
  });

  testWidgets('/ai/backtest-run resolves to AiBacktestRunPage', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/ai/backtest-run');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));

    expect(find.byType(AiBacktestRunPage), findsOneWidget);
    expect(find.byKey(const Key('qz-step-bar')), findsOneWidget);
    expect(find.text('回测进行中'), findsWidgets);
  });

  testWidgets('/ai/backtest-result resolves to AiBacktestResultPage', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/ai/backtest-result');
    await tester.pumpAndSettle();

    expect(find.byType(AiBacktestResultPage), findsOneWidget);
    expect(find.byKey(const Key('qz-step-bar')), findsOneWidget);
    expect(find.text('回测结果'), findsOneWidget);
  });

  testWidgets('/ai/deploy resolves to AiDeployPage', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/ai/deploy');
    await tester.pumpAndSettle();

    expect(find.byType(AiDeployPage), findsOneWidget);
    expect(find.byKey(const Key('qz-step-bar')), findsOneWidget);
    expect(find.text('部署策略'), findsWidgets);
    expect(find.byKey(const Key('deploy-step-indicator')), findsNothing);
  });

  testWidgets('/ai/confirm resolves to AiConfirmPage（#1832 确认策略屏）', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push('/ai/confirm');
    await tester.pumpAndSettle();

    expect(find.byType(AiConfirmPage), findsOneWidget);
    // #1891 内容对齐：Hero / 策略逻辑 RuleBlock / EXECUTE / 免责声明 / 双按钮
    // 均渲染（脚本预览块已下沉到 `/ai/script`，本屏不再有 copy-script）。
    expect(find.text('确认策略'), findsWidgets);
    expect(find.byKey(const Key('ai-confirm-hero')), findsOneWidget);
    expect(find.byKey(const Key('ai-confirm-rule-0')), findsOneWidget);
    // 底部双按钮在 sticky bar（始终在屏）。
    expect(find.byKey(const Key('ai-confirm-back-cta')), findsOneWidget);
    expect(find.byKey(const Key('ai-confirm-next-cta')), findsOneWidget);
    // 脚本预览块已移除（#1891 方案）。
    expect(find.byKey(const Key('ai-confirm-copy-script')), findsNothing);
    // EXECUTE / AI 提示 / 免责声明在长列表下方，滚动后再断言渲染。
    final Finder list = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.byKey(const Key('ai-confirm-execute')),
      300,
      scrollable: list,
    );
    expect(find.byKey(const Key('ai-confirm-execute')), findsOneWidget);
    await tester.scrollUntilVisible(
      find.byKey(const Key('ai-confirm-disclaimer')),
      300,
      scrollable: list,
    );
    expect(find.byKey(const Key('ai-confirm-advice')), findsOneWidget);
    expect(find.byKey(const Key('ai-confirm-disclaimer')), findsOneWidget);
  });

  testWidgets('/ai/confirm 接收 extra 参数并渲染到策略逻辑区', (WidgetTester tester) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).push(
      '/ai/confirm',
      extra: const <String, String>{
        'category': '均线突破',
        'symbol': 'BTC/USDT',
        'fast_ma': '7',
        'slow_ma': '30',
      },
    );
    await tester.pumpAndSettle();

    expect(find.byType(AiConfirmPage), findsOneWidget);
    // extra 透传的 category 进 Hero chip，断言非 mock 兜底值「趋势跟踪」。
    expect(find.text('均线突破'), findsWidgets);
    expect(find.text('趋势跟踪'), findsNothing);
    // 规则文案由 fast_ma/slow_ma 派生（如「MA7 上穿 MA30」），断言透传值落地。
    final Finder rule0 = find.byKey(const Key('ai-confirm-rule-0'));
    expect(
      find.descendant(of: rule0, matching: find.textContaining('MA7')),
      findsOneWidget,
      reason: 'extra 透传的 fast_ma=7 应渲染到 IF 规则文案',
    );
    expect(
      find.descendant(of: rule0, matching: find.textContaining('MA30')),
      findsOneWidget,
      reason: 'extra 透传的 slow_ma=30 应渲染到 IF 规则文案',
    );
  });

  test('/me/api 已下线（issue #1648）→ router 不再注册该路径', () {
    // API 配置入口统一为 bottom sheet（me_home + deploy sheet 均直接打开
    // `showApiFormSheet`），独立列表页 `/me/api` 已移除。守护这条测试，
    // 避免未来误恢复路由造成入口双轨。
    final String source = File('lib/router/app_router.dart').readAsStringSync();
    expect(
      source.contains("path: '/me/api'"),
      isFalse,
      reason: '/me/api 已下线，不应在 router 中重新注册',
    );
    expect(
      source.contains('ApiSettingsPage'),
      isFalse,
      reason: 'ApiSettingsPage 已删除，不应被 router 引用',
    );
  });

  testWidgets('/me/theme resolves to ThemeSettingsPage', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(
      tester,
      storage: _loggedInStorage(),
    );
    GoRouter.of(ctx).push('/me/theme');
    await tester.pumpAndSettle();

    expect(find.byType(ThemeSettingsPage), findsOneWidget);
  });

  testWidgets('/me/live resolves to LiveStrategiesPage（已登录）', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(
      tester,
      storage: _loggedInStorage(),
    );
    GoRouter.of(ctx).push('/me/live');
    await tester.pumpAndSettle();
    expect(find.byType(LiveStrategiesPage), findsOneWidget);
  });

  testWidgets('未登录访问 /me/live 弹 LoginSheet（#2075 受守卫）', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).go('/me/live');
    await tester.pumpAndSettle();
    expect(find.byType(LoginSheet), findsOneWidget);
    expect(find.byType(LiveStrategiesPage), findsNothing);
  });

  testWidgets('未登录首次启动落在 /strategy guest', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
        tokenStorageProvider.overrideWithValue(InMemoryTokenStorage()),
        authRepositoryProvider.overrideWithValue(MockAuthRepository()),
      ],
    );
    await c.read(sessionControllerProvider.future);
    await tester.pumpWidget(
      UncontrolledProviderScope(container: c, child: const QuantifyMobileApp()),
    );
    await tester.pumpAndSettle();
    expect(find.byType(StrategyGuestPage), findsOneWidget);
    expect(find.byType(ThemePreviewPage), findsNothing);
  });

  testWidgets('/_dev/theme-preview 仍可通过显式路径打开', (WidgetTester tester) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).go('/_dev/theme-preview');
    await tester.pumpAndSettle();
    expect(find.byType(ThemePreviewPage), findsOneWidget);
  });

  testWidgets('/_dev/components-preview resolves to ComponentsPreviewPage', (
    WidgetTester tester,
  ) async {
    final BuildContext ctx = await _pumpApp(tester);
    ctx.go('/_dev/components-preview');
    // Do not pumpAndSettle: the preview page renders QzSpinner whose
    // CircularProgressIndicator animates forever. A single frame commits the
    // GoRouter transition; the second 350 ms pump is just over the default
    // GoRouter cupertino/material transition (≈ 300 ms) so the new page
    // becomes the front-most route before we assert.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.byType(ComponentsPreviewPage), findsOneWidget);
  });

  testWidgets('theme-preview screen exposes a link to components-preview', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
        tokenStorageProvider.overrideWithValue(InMemoryTokenStorage()),
        authRepositoryProvider.overrideWithValue(MockAuthRepository()),
      ],
    );
    await c.read(sessionControllerProvider.future);
    await tester.pumpWidget(
      UncontrolledProviderScope(container: c, child: const QuantifyMobileApp()),
    );
    await tester.pumpAndSettle();
    // 默认 landing 是 /strategy guest，所以这里显式跳到主题预览。
    final BuildContext bootCtx = tester.element(find.byType(Navigator).first);
    GoRouter.of(bootCtx).go('/_dev/theme-preview');
    await tester.pumpAndSettle();
    // The link sits below the sample cards inside a ListView, so scroll
    // before asserting visibility.
    final Finder linkFinder = find.byKey(
      const ValueKey<String>('dev-link-components-preview'),
    );
    await tester.scrollUntilVisible(linkFinder, 200);
    expect(linkFinder, findsOneWidget);
  });

  testWidgets('未登录访问 /me 弹 LoginSheet', (WidgetTester tester) async {
    final BuildContext ctx = await _pumpApp(tester);
    GoRouter.of(ctx).go('/me');
    await tester.pumpAndSettle();
    expect(find.byType(LoginSheet), findsOneWidget);
    expect(find.byType(MeHomePage), findsNothing);
  });

  testWidgets('已登录直接访问 /me 不被拦', (WidgetTester tester) async {
    final AuthSession seed = AuthSession(
      userId: 'u',
      token: 't',
      email: 'a@b.com',
    );
    final InMemoryTokenStorage storage = InMemoryTokenStorage(<String, String>{
      kSessionStorageKey: jsonEncode(seed.toMap()),
    });
    final BuildContext ctx = await _pumpApp(tester, storage: storage);
    GoRouter.of(ctx).go('/me');
    await tester.pumpAndSettle();
    expect(find.byType(MeHomePage), findsOneWidget);
    expect(find.byType(LoginSheet), findsNothing);
  });

  testWidgets('登出后落到 /strategy guest', (WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(800, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final AuthSession seed = AuthSession(
      userId: 'u',
      token: 't',
      email: 'a@b.com',
    );
    final InMemoryTokenStorage storage = InMemoryTokenStorage(<String, String>{
      kSessionStorageKey: jsonEncode(seed.toMap()),
    });
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer container = ProviderContainer(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
        tokenStorageProvider.overrideWithValue(storage),
        authRepositoryProvider.overrideWithValue(MockAuthRepository()),
      ],
    );
    await container.read(sessionControllerProvider.future);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const QuantifyMobileApp(),
      ),
    );
    await tester.pumpAndSettle();
    final BuildContext ctx = tester.element(find.byType(Navigator).first);
    GoRouter.of(ctx).go('/me');
    await tester.pumpAndSettle();
    expect(find.byType(MeHomePage), findsOneWidget);

    final Finder logout = find.byKey(const Key('me-logout-button'));
    await tester.scrollUntilVisible(logout, 300);
    await tester.ensureVisible(logout);
    await tester.tap(logout);
    await tester.pumpAndSettle();
    expect(container.read(sessionControllerProvider).value, isNull);
    expect(find.byType(StrategyGuestPage), findsOneWidget);
    expect(find.byType(MeHomePage), findsNothing);
  });
}
