import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/auth/session_controller.dart';
import '../data/models/auth_models.dart';
import '../pages/_dev/components_preview_page.dart';
import '../pages/_dev/theme_preview_page.dart';
import '../pages/ai/ai_confirm_page.dart';
import '../pages/ai/ai_backtest_result_page.dart';
import '../pages/ai/ai_backtest_run_page.dart';
import '../pages/ai/ai_deploy_page.dart';
import '../pages/ai/ai_home_page.dart';
import '../pages/ai/ai_script_page.dart';
import '../pages/ai/backtest_config_sheet.dart';
import '../pages/auth/login_sheet.dart';
import '../pages/live/live_strategies_page.dart';
import '../pages/live/live_strategy_detail_page.dart';
import '../pages/market/data_hub_page.dart';
import '../pages/market/market_detail_page.dart';
import '../pages/market/widgets/data_hub_header.dart';
import '../pages/me/me_home_page.dart';
import '../pages/me/theme_settings_page.dart';
import '../pages/strategy/strategy_detail_page.dart';
import '../pages/strategy/strategy_guest_page.dart';
import '../pages/strategy/strategy_home_page.dart';
import '../pages/whale/whale_home_page.dart';
import '../pages/whale/whale_profile_page.dart';
import '../shell/main_shell_scaffold.dart';

/// App-wide router.
///
/// - 5 bottom tabs live inside a single [StatefulShellRoute.indexedStack] so
///   each branch preserves its own navigation + widget state across tab
///   switches. Branch order is the canonical tab order (mirrors
///   `QzBottomTabBar` and `docs/components.md`):
///     index 0 → `/strategy` (策略)
///     index 1 → `/ai`       (AI 量化)
///     index 2 → `/market`   (行情)
///     index 3 → `/whale`    (巨鲸)
///     index 4 → `/me`       (我的)
///   Reordering branches without updating `QzBottomTabBar` + the two
///   navigation tests below will break the index ↔ tab mapping.
/// - Sub-views (`/market/:symbol`, `/market/long-short`,
///   `/ai/backtest-config`, `/me/theme`) are top-level routes that
///   intentionally sit outside the shell — pushing them covers the bottom
///   tab bar (full-screen modal-style navigation).
/// 需要登录才能访问的路径前缀白名单。
///
/// 守卫策略与原型 07 屏一致：`/me`（个人中心 + 子页 `/me/theme`）必须登录；
/// 行情/AI/鲸鱼/策略 浏览均允许匿名。
///
/// 注意：使用前缀匹配是为了让 `/me/*` 子路由自动落入守卫，不需要逐条枚举。
/// API 配置入口（issue #1648）：「我的」首页与一键部署弹层均直接打开
/// `showApiFormSheet`，不再保留独立 `/me/api` 列表页。
const List<String> kAuthProtectedPrefixes = <String>['/me'];

/// 构建 app 路由。
///
/// 参数：
/// - [readSession]：同步读取当前 session（GoRouter.redirect 必须同步）。
///   默认全公开，保证既有 widget test 与无 auth 环境下行为不变。
/// - [refreshListenable]：session 变化时触发 GoRouter 重新评估 redirect。
GoRouter buildRouter({
  AuthSession? Function()? readSession,
  Listenable? refreshListenable,
}) {
  final AuthSession? Function() read = readSession ?? () => null;
  return GoRouter(
    // 默认入口：匿名可逛策略 guest landing。
    // `/_dev/theme-preview` 与 `/_dev/components-preview` 仍通过显式路径访问，
    // 不再作为 debug 模式 landing。
    initialLocation: '/strategy',
    refreshListenable: refreshListenable,
    redirect: (BuildContext context, GoRouterState state) => null,
    routes: <RouteBase>[
      StatefulShellRoute.indexedStack(
        builder:
            (
              BuildContext context,
              GoRouterState state,
              StatefulNavigationShell shell,
            ) => MainShellScaffold(navigationShell: shell),
        branches: <StatefulShellBranch>[
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: '/strategy',
                builder: (BuildContext context, GoRouterState state) =>
                    const _StrategyEntryPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: '/ai',
                builder: (BuildContext context, GoRouterState state) =>
                    const AiHomePage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: '/market',
                builder: (BuildContext context, GoRouterState state) =>
                    const DataHubPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: '/whale',
                builder: (BuildContext context, GoRouterState state) =>
                    const WhaleHomePage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: '/me',
                builder: (BuildContext context, GoRouterState state) =>
                    read() == null
                    ? const _LoginSheetGatePage()
                    : const MeHomePage(),
              ),
            ],
          ),
        ],
      ),
      // Top-level sub-views — push 进入会覆盖底部 tab bar。
      //
      // 三重保护防止 `/market/long-short` 被动态段吞没：
      //   1. `long-short` 显式注册在 `:symbol` 之前（声明顺序）
      //   2. `:symbol` 上挂正则 `[A-Z0-9-]{2,}` 限制为大写交易对格式，
      //      `long-short` 字面量（小写）不命中
      //   3. widget test `/market/long-short 预选多空比 tab` 守护
      // 这样后续 import 排序工具/代码格式化即便重排路由也不会静默打破。
      // 多空比深链（#1853）：渲染「数据」hub 并预选多空比 tab，顶部统一为
      // DataHubHeader（去掉旧 QzTopBar 包装层），与底栏入口体验一致。
      GoRoute(
        path: '/market/long-short',
        builder: (BuildContext context, GoRouterState state) =>
            const DataHubPage(initial: DataHubScreen.longShort),
      ),
      GoRoute(
        path: r'/market/:symbol([A-Z0-9-]{2,})',
        builder: (BuildContext context, GoRouterState s) =>
            MarketDetailPage(symbol: s.pathParameters['symbol']!),
      ),
      GoRoute(
        path: '/strategy/:id',
        builder: (BuildContext context, GoRouterState s) =>
            StrategyDetailPage(id: s.pathParameters['id']!),
      ),
      // 巨鲸地址详情（#1753）：公开（不在 kAuthProtectedPrefixes，匿名可浏览）。
      // address 含 `…` 省略号与 `0x` 前缀，入口用 Uri.encodeComponent，
      // go_router 自动 decode 回原文。
      GoRoute(
        path: '/whale/profile/:address',
        builder: (BuildContext context, GoRouterState s) =>
            WhaleProfilePage(address: s.pathParameters['address']!),
      ),
      // 确认策略屏（#1832）：参数气泡「确认策略」CTA 进入；当前会话参数经
      // `extra`（Map<String, String>）透传。深链直达（无 extra）回退 mock 参数。
      GoRoute(
        path: '/ai/confirm',
        builder: (BuildContext context, GoRouterState state) {
          final Object? extra = state.extra;
          return AiConfirmPage(
            params: extra is Map<String, String> ? extra : null,
          );
        },
      ),
      // 策略脚本屏（#1892）：确认页「下一步：策略脚本」进入，向导第 2 步；
      // 当前会话参数经 `extra`（Map<String, String>）透传，深链直达回退 mock。
      GoRoute(
        path: '/ai/script',
        builder: (BuildContext context, GoRouterState state) {
          final Object? extra = state.extra;
          return AiScriptPage(
            params: extra is Map<String, String> ? extra : null,
          );
        },
      ),
      GoRoute(
        path: '/ai/backtest-config',
        builder: (BuildContext context, GoRouterState state) =>
            const BacktestConfigSheet(),
      ),
      GoRoute(
        path: '/ai/backtest-run',
        builder: (BuildContext context, GoRouterState state) =>
            const AiBacktestRunPage(),
      ),
      GoRoute(
        path: '/ai/backtest-result',
        builder: (BuildContext context, GoRouterState state) =>
            const AiBacktestResultPage(),
      ),
      GoRoute(
        path: '/ai/deploy',
        builder: (BuildContext context, GoRouterState state) =>
            const AiDeployPage(),
      ),
      GoRoute(
        path: '/me/theme',
        builder: (BuildContext context, GoRouterState state) => read() == null
            ? const _LoginSheetGatePage()
            : const ThemeSettingsPage(),
      ),
      // 实盘策略（#1752）：列表 + 详情，均落在 `/me` 前缀守卫内（需登录）。
      // 详情 `:id` 显式注册在列表之后；`live` 字面量不会被静态段吞没。
      GoRoute(
        path: '/me/live',
        builder: (BuildContext context, GoRouterState state) => read() == null
            ? const _LoginSheetGatePage()
            : const LiveStrategiesPage(),
      ),
      GoRoute(
        path: '/me/live/:id',
        builder: (BuildContext context, GoRouterState s) => read() == null
            ? const _LoginSheetGatePage()
            : LiveStrategyDetailPage(id: s.pathParameters['id']!),
      ),
      if (kDebugMode)
        GoRoute(
          path: '/_dev/theme-preview',
          builder: (BuildContext context, GoRouterState state) =>
              const ThemePreviewPage(),
        ),
      if (kDebugMode)
        GoRoute(
          path: '/_dev/components-preview',
          builder: (BuildContext context, GoRouterState state) =>
              const ComponentsPreviewPage(),
        ),
    ],
  );
}

class _StrategyEntryPage extends ConsumerWidget {
  const _StrategyEntryPage();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthSession? session = ref
        .watch(sessionControllerProvider)
        .value;
    return session == null
        ? const StrategyGuestPage()
        : const StrategyHomePage();
  }
}

class _LoginSheetGatePage extends StatefulWidget {
  const _LoginSheetGatePage();

  @override
  State<_LoginSheetGatePage> createState() => _LoginSheetGatePageState();
}

class _LoginSheetGatePageState extends State<_LoginSheetGatePage> {
  bool _opened = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_opened) return;
    _opened = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await showLoginSheet(context);
      if (!mounted) return;
      context.go('/strategy');
    });
  }

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink(key: Key('login-sheet-gate'));
  }
}
