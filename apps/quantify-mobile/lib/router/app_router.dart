import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../data/models/auth_models.dart';
import '../pages/_dev/components_preview_page.dart';
import '../pages/_dev/theme_preview_page.dart';
import '../pages/ai/ai_home_page.dart';
import '../pages/ai/backtest_config_sheet.dart';
import '../pages/auth/login_page.dart';
import '../pages/live/live_strategies_page.dart';
import '../pages/live/live_strategy_detail_page.dart';
import '../pages/market/long_short_page.dart';
import '../pages/market/market_detail_page.dart';
import '../pages/market/market_home_page.dart';
import '../pages/me/me_home_page.dart';
import '../pages/me/theme_settings_page.dart';
import '../pages/strategy/strategy_detail_page.dart';
import '../pages/strategy/strategy_home_page.dart';
import '../pages/whale/whale_home_page.dart';
import '../shell/main_shell_scaffold.dart';

/// App-wide router.
///
/// - 5 bottom tabs live inside a single [StatefulShellRoute.indexedStack] so
///   each branch preserves its own navigation + widget state across tab
///   switches. Branch order is the canonical tab order (mirrors
///   `QzBottomTabBar` and `docs/components.md`):
///     index 0 → `/ai`       (AI 量化)
///     index 1 → `/market`   (行情)
///     index 2 → `/strategy` (策略)
///     index 3 → `/whale`    (巨鲸)
///     index 4 → `/me`       (我的)
///   Reordering branches without updating `QzBottomTabBar` + the two
///   navigation tests below will break the index ↔ tab mapping.
/// - Sub-views (`/login`, `/market/:symbol`, `/market/long-short`,
///   `/ai/backtest-config`, `/me/theme`) are top-level routes that
///   intentionally sit outside the shell — pushing them covers the bottom
///   tab bar (full-screen modal-style navigation).
/// 需要登录才能访问的路径前缀白名单。
///
/// 守卫策略与原型 07 屏一致：`/me`（个人中心 + 子页 `/me/theme`）必须登录；
/// 行情/AI/鲸鱼/策略 浏览均允许匿名。
///
/// 注意：使用前缀匹配是为了让 `/me/*` 子路由自动落入守卫，不需要逐条枚举。
/// `/login` 永远是公开的，否则会与 redirect 形成死循环。
/// API 配置入口（issue #1648）：「我的」首页与一键部署弹层均直接打开
/// `showApiFormSheet`，不再保留独立 `/me/api` 列表页。
const List<String> kAuthProtectedPrefixes = <String>['/me'];

bool _isProtected(String location) {
  for (final String prefix in kAuthProtectedPrefixes) {
    if (location == prefix || location.startsWith('$prefix/')) {
      return true;
    }
  }
  return false;
}

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
    // 默认入口：未登录用户落到 `/login`（与原型 07 屏一致）。
    // `/_dev/theme-preview` 与 `/_dev/components-preview` 仍通过显式路径访问，
    // 不再作为 debug 模式 landing。已登录场景由下方 redirect 把 `/login` 引到 `/ai`。
    initialLocation: '/login',
    refreshListenable: refreshListenable,
    redirect: (BuildContext context, GoRouterState state) {
      final bool loggedIn = read() != null;
      final String loc = state.matchedLocation;
      if (!loggedIn && _isProtected(loc)) return '/login';
      if (loggedIn && loc == '/login') return '/ai';
      return null;
    },
    routes: <RouteBase>[
      StatefulShellRoute.indexedStack(
        builder: (
          BuildContext context,
          GoRouterState state,
          StatefulNavigationShell shell,
        ) =>
            MainShellScaffold(navigationShell: shell),
        branches: <StatefulShellBranch>[
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
                    const MarketHomePage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: '/strategy',
                builder: (BuildContext context, GoRouterState state) =>
                    const StrategyHomePage(),
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
                    const MeHomePage(),
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
      //   3. widget test `/market/long-short resolves to LongShortPage` 守护
      // 这样后续 import 排序工具/代码格式化即便重排路由也不会静默打破。
      GoRoute(
        path: '/login',
        builder: (BuildContext context, GoRouterState state) => const LoginPage(),
      ),
      GoRoute(
        path: '/market/long-short',
        builder: (BuildContext context, GoRouterState state) => const LongShortPage(),
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
      GoRoute(
        path: '/ai/backtest-config',
        builder: (BuildContext context, GoRouterState state) =>
            const BacktestConfigSheet(),
      ),
      GoRoute(
        path: '/me/theme',
        builder: (BuildContext context, GoRouterState state) => const ThemeSettingsPage(),
      ),
      // 实盘策略（#1752）：列表 + 详情，均落在 `/me` 前缀守卫内（需登录）。
      // 详情 `:id` 显式注册在列表之后；`live` 字面量不会被静态段吞没。
      GoRoute(
        path: '/me/live',
        builder: (BuildContext context, GoRouterState state) =>
            const LiveStrategiesPage(),
      ),
      GoRoute(
        path: '/me/live/:id',
        builder: (BuildContext context, GoRouterState s) =>
            LiveStrategyDetailPage(id: s.pathParameters['id']!),
      ),
      if (kDebugMode)
        GoRoute(
          path: '/_dev/theme-preview',
          builder: (BuildContext context, GoRouterState state) => const ThemePreviewPage(),
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
