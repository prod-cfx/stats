import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../widgets/qz_bottom_tab_bar.dart';

/// Shell scaffold hosting the 5 bottom tabs via [StatefulNavigationShell].
///
/// `extendBody: true` lets the body draw underneath the bottom bar so the
/// real [BackdropFilter] blur inside [QzBottomTabBar] can sample scroll
/// content behind it (frosted-glass effect matching the design spec). The
/// `tabBlur` token color acts as a tint overlay on top of the blurred
/// sample. The bottom bar itself consumes the device's bottom safe-area
/// inset (iOS home indicator handled by [BottomNavigationBar]).
class MainShellScaffold extends StatelessWidget {
  const MainShellScaffold({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: navigationShell,
      bottomNavigationBar: QzBottomTabBar(
        currentIndex: navigationShell.currentIndex,
        onTap: (int i) => navigationShell.goBranch(
          i,
          // Tapping the active tab returns to its initial location, matching
          // standard iOS / Material tab-bar UX.
          initialLocation: i == navigationShell.currentIndex,
        ),
      ),
    );
  }
}
