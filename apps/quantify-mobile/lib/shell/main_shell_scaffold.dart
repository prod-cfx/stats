import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/auth/session_controller.dart';
import '../pages/auth/login_sheet.dart';
import '../widgets/qz_bottom_tab_bar.dart';

/// Shell scaffold hosting the 5 bottom tabs via [StatefulNavigationShell].
///
/// `extendBody: true` lets the body draw underneath the bottom bar so the
/// real [BackdropFilter] blur inside [QzBottomTabBar] can sample scroll
/// content behind it (frosted-glass effect matching the design spec). The
/// `tabBlur` token color acts as a tint overlay on top of the blurred
/// sample. The bottom bar itself consumes the device's bottom safe-area
/// inset (iOS home indicator handled by [BottomNavigationBar]).
class MainShellScaffold extends ConsumerWidget {
  const MainShellScaffold({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onTap(BuildContext context, WidgetRef ref, int i) {
    final bool loggedIn =
        ref.read(sessionControllerProvider).value != null;
    if (i == 4 && !loggedIn) {
      showLoginSheet(context);
      return;
    }
    navigationShell.goBranch(
      i,
      initialLocation: i == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      extendBody: true,
      body: navigationShell,
      bottomNavigationBar: QzBottomTabBar(
        currentIndex: navigationShell.currentIndex,
        onTap: (int i) => _onTap(context, ref, i),
      ),
    );
  }
}
