import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../theme/colors.dart';
import '../theme/theme_context.dart';

/// Bottom tab bar wrapping [BottomNavigationBar].
///
/// Visual contract:
/// - 5 fixed items (AI, 行情, 巨鲸, 策略, 我的) — each tagged with a stable
///   `ValueKey('tab-<name>')` so widget tests can target items without
///   depending on which Material icon ships with the build.
/// - Active color = scheme.accent; inactive = scheme.textDim
/// - Background = scheme.tabBlur (semi-transparent overlay color from tokens).
///   Real iOS-style blur via [BackdropFilter] is intentionally deferred to a
///   later PR; this PR only matches the token color so [Scaffold.extendBody]
///   shows whatever sits behind through the alpha channel.
class QzBottomTabBar extends StatelessWidget {
  static const int _tabCount = 5;

  const QzBottomTabBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  }) : assert(
          currentIndex >= 0 && currentIndex < _tabCount,
          'QzBottomTabBar.currentIndex must be in [0, 5)',
        );

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return BottomNavigationBar(
      currentIndex: currentIndex,
      onTap: onTap,
      type: BottomNavigationBarType.fixed,
      backgroundColor: c.tabBlur,
      elevation: 0,
      selectedItemColor: c.accent,
      unselectedItemColor: c.textDim,
      selectedFontSize: 11,
      unselectedFontSize: 11,
      items: <BottomNavigationBarItem>[
        BottomNavigationBarItem(
          icon: const Icon(Icons.auto_awesome, key: ValueKey<String>('tab-ai')),
          label: 'AI',
        ),
        BottomNavigationBarItem(
          icon: const Icon(Icons.show_chart, key: ValueKey<String>('tab-market')),
          label: l10n.tabMarket,
        ),
        BottomNavigationBarItem(
          icon: const Icon(Icons.water_drop_outlined, key: ValueKey<String>('tab-whale')),
          label: l10n.tabWhale,
        ),
        BottomNavigationBarItem(
          icon: const Icon(Icons.dashboard_outlined, key: ValueKey<String>('tab-strategy')),
          label: l10n.tabStrategy,
        ),
        BottomNavigationBarItem(
          icon: const Icon(Icons.person_outline, key: ValueKey<String>('tab-me')),
          label: l10n.tabMe,
        ),
      ],
    );
  }
}
