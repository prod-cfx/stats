import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';

import '../pages/_dev/theme_preview_page.dart';
import '../pages/me/theme_settings_page.dart';

/// Initial app router.
/// - Debug builds land on the dev theme preview for fast iteration.
/// - Release builds land directly on the production theme picker.
GoRouter buildRouter() {
  return GoRouter(
    initialLocation: kDebugMode ? '/_dev/theme-preview' : '/me/theme',
    routes: <RouteBase>[
      GoRoute(
        path: '/me/theme',
        builder: (_, _) => const ThemeSettingsPage(),
      ),
      if (kDebugMode)
        GoRoute(
          path: '/_dev/theme-preview',
          builder: (_, _) => const ThemePreviewPage(),
        ),
    ],
  );
}
