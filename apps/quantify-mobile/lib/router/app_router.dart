import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../pages/_dev/theme_preview_page.dart';
import '../pages/ai/ai_home_page.dart';
import '../pages/ai/backtest_config_sheet.dart';
import '../pages/auth/login_page.dart';
import '../pages/market/long_short_page.dart';
import '../pages/market/market_detail_page.dart';
import '../pages/market/market_home_page.dart';
import '../pages/me/api_settings_page.dart';
import '../pages/me/me_home_page.dart';
import '../pages/me/theme_settings_page.dart';
import '../pages/strategy/strategy_home_page.dart';
import '../pages/whale/whale_home_page.dart';
import '../shell/main_shell_scaffold.dart';

/// App-wide router.
///
/// - 5 bottom tabs (`/ai`, `/market`, `/whale`, `/strategy`, `/me`) live inside
///   a single [StatefulShellRoute.indexedStack] so each branch preserves its
///   own navigation + widget state across tab switches.
/// - Sub-views (`/login`, `/market/:symbol`, `/market/long-short`,
///   `/ai/backtest-config`, `/me/api`, `/me/theme`) are top-level routes that
///   intentionally sit outside the shell — pushing them covers the bottom
///   tab bar (full-screen modal-style navigation).
GoRouter buildRouter() {
  return GoRouter(
    initialLocation: kDebugMode ? '/_dev/theme-preview' : '/ai',
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
                path: '/whale',
                builder: (BuildContext context, GoRouterState state) =>
                    const WhaleHomePage(),
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
        path: '/ai/backtest-config',
        builder: (BuildContext context, GoRouterState state) =>
            const BacktestConfigSheet(),
      ),
      GoRoute(
        path: '/me/api',
        builder: (BuildContext context, GoRouterState state) => const ApiSettingsPage(),
      ),
      GoRoute(
        path: '/me/theme',
        builder: (BuildContext context, GoRouterState state) => const ThemeSettingsPage(),
      ),
      if (kDebugMode)
        GoRoute(
          path: '/_dev/theme-preview',
          builder: (BuildContext context, GoRouterState state) => const ThemePreviewPage(),
        ),
    ],
  );
}
