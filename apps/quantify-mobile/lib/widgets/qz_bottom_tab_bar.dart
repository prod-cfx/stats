import 'package:flutter/material.dart';

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
  const QzBottomTabBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
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
      items: const <BottomNavigationBarItem>[
        BottomNavigationBarItem(
          icon: Icon(Icons.auto_awesome, key: ValueKey<String>('tab-ai')),
          label: 'AI',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.show_chart, key: ValueKey<String>('tab-market')),
          label: '行情',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.water_drop_outlined, key: ValueKey<String>('tab-whale')),
          label: '巨鲸',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.dashboard_outlined, key: ValueKey<String>('tab-strategy')),
          label: '策略',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.person_outline, key: ValueKey<String>('tab-me')),
          label: '我的',
        ),
      ],
    );
  }
}
