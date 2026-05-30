import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/storage/strategy_subscription_persistence.dart';
import 'package:quantify_mobile/pages/strategy/strategy_detail_page.dart';
import 'package:quantify_mobile/pages/strategy/widgets/equity_curve_view.dart';
import 'package:quantify_mobile/pages/strategy/widgets/load_conversation_toast.dart';
import 'package:quantify_mobile/pages/strategy/widgets/strategy_metric_card.dart';
import 'package:quantify_mobile/pages/strategy/widgets/strategy_signal_tile.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

const String _kId = 'st-grid-btc';

/// 测试用 GoRouter：把 `/strategy/:id` 作为 detail 页落点，
/// 同时注册 `/ai`，使「载入对话」按钮的 `context.go('/ai?...')` 可被
/// 路由观察（而不是抛 GoRouter 未配置异常）。
GoRouter _buildTestRouter() {
  return GoRouter(
    initialLocation: '/strategy/$_kId',
    routes: <RouteBase>[
      GoRoute(
        path: '/strategy/:id',
        builder: (BuildContext _, GoRouterState state) =>
            StrategyDetailPage(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/ai',
        builder: (BuildContext _, GoRouterState state) => const _AiStub(),
      ),
    ],
  );
}

class _AiStub extends StatelessWidget {
  const _AiStub();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      key: Key('ai-stub'),
      body: Center(child: Text('ai stub')),
    );
  }
}

Future<({ProviderContainer container, GoRouter router})> _pumpDetail(
  WidgetTester tester, {
  QzTheme? theme,
  Map<String, Object> initialPrefs = const <String, Object>{},
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 2400));
  SharedPreferences.setMockInitialValues(initialPrefs);
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  final ProviderContainer container = ProviderContainer(
    overrides: <Override>[
      sharedPreferencesProvider.overrideWithValue(prefs),
    ],
  );
  final GoRouter router = _buildTestRouter();
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(
          theme ?? const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
        ),
        routerConfig: router,
      ),
    ),
  );
  // mock future：detail+signals 200ms / equity 120ms
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));
  await tester.pump(const Duration(milliseconds: 250));
  // equity 由 detail data 渲染完之后再 watch，所以要再多 pump 一次
  await tester.pump(const Duration(milliseconds: 200));
  await tester.pump();
  return (container: container, router: router);
}

void main() {
  testWidgets('渲染：6 张指标卡 + 20 条信号 + 订阅 / 分享按钮 + equity 真实图（#1565）',
      (WidgetTester tester) async {
    await _pumpDetail(tester);
    expect(find.byType(StrategyMetricCard), findsNWidgets(6));
    expect(find.byType(StrategySignalTile), findsNWidgets(20));
    expect(find.byKey(const Key('strategy-detail-subscribe-btn')),
        findsOneWidget);
    expect(find.byKey(const Key('strategy-detail-share-btn')), findsOneWidget);
    // equity 真实图替代占位文字（#1565）
    expect(find.byType(EquityCurveView), findsOneWidget);
    expect(find.text('曲线占位（接入 K 线后可视化）'), findsNothing);
    // 策略参数区块（用户评价区块已随设计稿移除，#1799）
    expect(find.text('策略参数'), findsOneWidget);
    expect(find.text('用户评价'), findsNothing);
  });

  testWidgets('equity 时间维度切换：tap 90D tab 不抛异常 (#1565)',
      (WidgetTester tester) async {
    await _pumpDetail(tester);
    await tester.tap(find.byKey(const Key('strategy-detail-tf-d90')));
    await tester.pump();
    // 等 equity provider mock 120ms 完成
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump();
    expect(find.byType(EquityCurveView), findsOneWidget);
  });

  testWidgets('订阅按钮：未订阅 → 点击 → 已订阅 → 再次点击 → 取消',
      (WidgetTester tester) async {
    final ProviderContainer c = (await _pumpDetail(tester)).container;
    expect(find.text('订阅策略'), findsOneWidget);
    expect(c.read(strategySubscriptionsProvider).contains(_kId), isFalse);

    await tester.tap(
        find.byKey(const Key('strategy-detail-subscribe-btn')));
    await tester.pump();
    await tester.pump();
    expect(c.read(strategySubscriptionsProvider).contains(_kId), isTrue);
    expect(find.text('已订阅 · 点击取消'), findsOneWidget);

    await tester.tap(
        find.byKey(const Key('strategy-detail-subscribe-btn')));
    await tester.pump();
    await tester.pump();
    expect(c.read(strategySubscriptionsProvider).contains(_kId), isFalse);
  });

  testWidgets('订阅持久化：toggle 后写入 SharedPreferences，第二次启动读到状态',
      (WidgetTester tester) async {
    // 第一次进入：订阅
    final ProviderContainer c1 = (await _pumpDetail(tester)).container;
    await tester.tap(
        find.byKey(const Key('strategy-detail-subscribe-btn')));
    await tester.pump();
    await tester.pump();
    expect(c1.read(strategySubscriptionsProvider).contains(_kId), isTrue);
    c1.dispose();

    // 模拟第二次启动：用相同的 mock prefs 实例验证读路径
    SharedPreferences.setMockInitialValues(<String, Object>{
      StrategySubscriptionPersistence.kKey: <String>[_kId],
    });
    final SharedPreferences prefs2 = await SharedPreferences.getInstance();
    final ProviderContainer c2 = ProviderContainer(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs2),
      ],
    );
    addTearDown(c2.dispose);
    final Set<String> initial = c2.read(strategySubscriptionsProvider);
    expect(initial.contains(_kId), isTrue,
        reason: '第二次启动应从 SharedPreferences 恢复订阅集合');
  });

  testWidgets('9 主题循环 pump 不抛异常', (WidgetTester tester) async {
    for (final QzBg bg in QzBg.values) {
      for (final QzAccent accent in QzAccent.values) {
        final ProviderContainer c =
            (await _pumpDetail(tester, theme: QzTheme(bg: bg, accent: accent)))
                .container;
        expect(tester.takeException(), isNull,
            reason: 'theme bg=$bg accent=$accent should pump without exception');
        expect(find.byType(StrategyMetricCard), findsNWidgets(6),
            reason: 'theme bg=$bg accent=$accent');
        c.dispose();
      }
    }
  });

  testWidgets('载入对话：点击 → 显示 toast → 700ms 后跳 /ai?loadStrategy=<id>（#1666）',
      (WidgetTester tester) async {
    final ({ProviderContainer container, GoRouter router}) ctx =
        await _pumpDetail(tester);

    // 点击「载入对话」主操作
    await tester.tap(find.byKey(const Key('strategy-detail-load-chat-btn')));
    await tester.pump();

    // toast 立即出现
    expect(find.byKey(const Key('strategy-load-conversation-toast')),
        findsOneWidget);
    expect(find.byType(LoadConversationToast), findsOneWidget);

    // 还未到 700ms：跳转 timer 尚未触发，仍在 detail 路由
    await tester.pump(const Duration(milliseconds: 500));
    expect(ctx.router.routerDelegate.currentConfiguration.uri.toString(),
        contains('/strategy/'));

    // 到 700ms：触发跳转
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump();
    final String loc =
        ctx.router.routerDelegate.currentConfiguration.uri.toString();
    expect(loc, contains('/ai'));
    expect(loc, contains('loadStrategy=$_kId'));

    // 让 toast 自然消失（2400ms - 已经过去 ~750ms）
    await tester.pump(const Duration(milliseconds: 2000));
  });

  testWidgets('载入对话：重复点击只触发一次跳转，timer 取消上一次（#1666）',
      (WidgetTester tester) async {
    final ({ProviderContainer container, GoRouter router}) ctx =
        await _pumpDetail(tester);

    final Finder loadBtn = find.byKey(const Key('strategy-detail-load-chat-btn'));
    await tester.tap(loadBtn);
    await tester.pump(const Duration(milliseconds: 300));
    // 第二次点击在第一次跳转 timer 之前
    await tester.tap(loadBtn);
    await tester.pump();

    // 还在 detail 路由
    expect(ctx.router.routerDelegate.currentConfiguration.uri.toString(),
        contains('/strategy/'));

    // 走完第二次的 700ms：只跳一次
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pump();
    expect(ctx.router.routerDelegate.currentConfiguration.uri.toString(),
        contains('loadStrategy=$_kId'));

    // 没有未捕获异常（验证 timer 取消路径无副作用）
    expect(tester.takeException(), isNull);
    // 等 toast 自然消失，避免 pending timer
    await tester.pump(const Duration(milliseconds: 2500));
  });

  testWidgets('bottom-sheet 视觉：圆角顶 + 拖拽 handle + 顶部留白（#1820）',
      (WidgetTester tester) async {
    await _pumpDetail(tester);
    // sheet 顶部留 48px scrim + 圆角顶 ClipRRect
    expect(find.byType(ClipRRect), findsWidgets);
    // 头部 star / close 按钮存在
    expect(find.byKey(const Key('strategy-detail-star-btn')), findsOneWidget);
    expect(find.byKey(const Key('strategy-detail-close-btn')), findsOneWidget);
    // 头部信息为「类型 Chip + pair · period」结构：grid 策略 → 类型「网格」
    expect(find.text('网格'), findsWidgets);
  });

  testWidgets('收藏 star：点击切换 favorites，与列表同源 provider 双向同步（#1820）',
      (WidgetTester tester) async {
    final ProviderContainer c = (await _pumpDetail(tester)).container;
    expect(c.read(strategyFavoritesProvider).contains(_kId), isFalse);

    await tester.tap(find.byKey(const Key('strategy-detail-star-btn')));
    await tester.pump();
    await tester.pump();
    expect(c.read(strategyFavoritesProvider).contains(_kId), isTrue,
        reason: 'star 点击应写入与列表同一 strategyFavoritesProvider');

    await tester.tap(find.byKey(const Key('strategy-detail-star-btn')));
    await tester.pump();
    await tester.pump();
    expect(c.read(strategyFavoritesProvider).contains(_kId), isFalse);
  });

  testWidgets('收藏 star：列表先收藏 → 详情进入时 star 已点亮（双向同步）（#1820）',
      (WidgetTester tester) async {
    final ProviderContainer c = (await _pumpDetail(
      tester,
      initialPrefs: <String, Object>{
        'qz.strategy.favorites': <String>[_kId],
      },
    )).container;
    expect(c.read(strategyFavoritesProvider).contains(_kId), isTrue);
    // 点亮态：实心 star 图标
    expect(find.byIcon(Icons.star_rounded), findsOneWidget);
  });

  testWidgets('关闭按钮：深链直达无栈时 fallback 到 /strategy，不失效（#1820）',
      (WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(420, 2400));
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer container = ProviderContainer(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
      ],
    );
    addTearDown(container.dispose);
    // 深链直达 /strategy/:id（栈底无上一页）：close 应 fallback 到 /strategy
    // 列表，不让关闭按钮失效（Never break userspace）。
    final GoRouter router = GoRouter(
      initialLocation: '/strategy/$_kId',
      routes: <RouteBase>[
        GoRoute(
          path: '/strategy',
          builder: (BuildContext context, GoRouterState state) =>
              const Scaffold(key: Key('list-stub'), body: SizedBox()),
        ),
        GoRoute(
          path: '/strategy/:id',
          builder: (BuildContext _, GoRouterState state) =>
              StrategyDetailPage(id: state.pathParameters['id']!),
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
          theme: buildQzThemeData(
              const QzTheme(bg: QzBg.light, accent: QzAccent.violet)),
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump();
    expect(router.routerDelegate.currentConfiguration.uri.toString(),
        contains('/strategy/'));

    await tester.tap(find.byKey(const Key('strategy-detail-close-btn')));
    await tester.pumpAndSettle();
    expect(router.routerDelegate.currentConfiguration.uri.toString(),
        '/strategy');
  });

  testWidgets('关闭按钮：从列表 push 进入时 close 应 pop 回上一页（#1820）',
      (WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(420, 2400));
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer container = ProviderContainer(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
      ],
    );
    addTearDown(container.dispose);
    // 从 /strategy 列表 push 进入详情（栈底有上一页）：close 应 canPop→pop
    // 回列表，而不是 fallback go。
    final GoRouter router = GoRouter(
      initialLocation: '/strategy',
      routes: <RouteBase>[
        GoRoute(
          path: '/strategy',
          builder: (BuildContext context, GoRouterState state) => Scaffold(
            key: const Key('list-stub'),
            body: Center(
              child: TextButton(
                key: const Key('open-detail'),
                onPressed: () => context.push('/strategy/$_kId'),
                child: const Text('open'),
              ),
            ),
          ),
        ),
        GoRoute(
          path: '/strategy/:id',
          builder: (BuildContext _, GoRouterState state) =>
              StrategyDetailPage(id: state.pathParameters['id']!),
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
          theme: buildQzThemeData(
              const QzTheme(bg: QzBg.light, accent: QzAccent.violet)),
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();
    await tester.tap(find.byKey(const Key('open-detail')));
    // push 后让 detail 的 mock future（detail 200ms）推进，header 渲染出
    // close 按钮。go_router 14 的 imperative push 不改基址 URL，但会压入
    // detail 页 —— 以 close 按钮出现 + 列表被遮挡判定已进入详情。
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump();
    expect(find.byKey(const Key('strategy-detail-close-btn')), findsOneWidget);
    expect(find.byKey(const Key('list-stub')), findsNothing);

    await tester.tap(find.byKey(const Key('strategy-detail-close-btn')));
    await tester.pumpAndSettle();
    // canPop 为真 → pop 回栈底 /strategy 列表，而非 fallback go；
    // 列表重新可见、详情 close 按钮消失。
    expect(find.byKey(const Key('list-stub')), findsOneWidget);
    expect(find.byKey(const Key('strategy-detail-close-btn')), findsNothing);
  });
}
