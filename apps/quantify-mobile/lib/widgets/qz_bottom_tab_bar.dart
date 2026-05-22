import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../theme/colors.dart';
import '../theme/theme_context.dart';

/// Bottom tab bar matching the `MTabBar` design (`design/project/mobile/m-shell.jsx`).
///
/// Visual contract:
/// - 5 fixed items (AI 量化, 行情, 策略, 巨鲸, 我的) — each tagged with a stable
///   `ValueKey('tab-<name>')` so widget tests can target items without
///   depending on which Material icon ships with the build.
/// - Active tab shows a 42x28 rounded pill behind the icon, filled with
///   `scheme.accentSoft`; inactive items have a transparent pill slot.
/// - Active color = `scheme.accent`; inactive = `scheme.textDim`.
/// - Background = `scheme.tabBlur` (semi-transparent token color); a 1px top
///   border uses `scheme.borderSoft`. Real iOS-style blur via [BackdropFilter]
///   is intentionally deferred to a later PR; this PR only matches the token
///   color so [Scaffold.extendBody] shows whatever sits behind through alpha.
/// - Preserves bottom safe-area inset for iOS home indicator.
class QzBottomTabBar extends StatelessWidget {
  static const int _tabCount = 5;
  static const double _pillWidth = 42;
  static const double _pillHeight = 28;
  static const double _pillRadius = 14;

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
    final List<_TabSpec> tabs = <_TabSpec>[
      _TabSpec(keyName: 'ai', icon: Icons.auto_awesome, label: 'AI 量化'),
      _TabSpec(keyName: 'market', icon: Icons.show_chart, label: l10n.tabMarket),
      _TabSpec(keyName: 'strategy', icon: Icons.dashboard_outlined, label: l10n.tabStrategy),
      _TabSpec(keyName: 'whale', icon: Icons.water_drop_outlined, label: l10n.tabWhale),
      _TabSpec(keyName: 'me', icon: Icons.person_outline, label: l10n.tabMe),
    ];
    return Material(
      type: MaterialType.transparency,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: c.tabBlur,
          border: Border(top: BorderSide(color: c.borderSoft, width: 1)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(4, 8, 4, 0),
            child: Row(
              children: <Widget>[
                for (int i = 0; i < tabs.length; i++)
                  Expanded(
                    child: _TabItem(
                      spec: tabs[i],
                      active: i == currentIndex,
                      onTap: () => onTap(i),
                      scheme: c,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TabSpec {
  const _TabSpec({
    required this.keyName,
    required this.icon,
    required this.label,
  });

  final String keyName;
  final IconData icon;
  final String label;
}

class _TabItem extends StatelessWidget {
  const _TabItem({
    required this.spec,
    required this.active,
    required this.onTap,
    required this.scheme,
  });

  final _TabSpec spec;
  final bool active;
  final VoidCallback onTap;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final Color fg = active ? scheme.accent : scheme.textDim;
    return InkResponse(
      onTap: onTap,
      containedInkWell: false,
      highlightShape: BoxShape.rectangle,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              width: QzBottomTabBar._pillWidth,
              height: QzBottomTabBar._pillHeight,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active ? scheme.accentSoft : Colors.transparent,
                borderRadius: BorderRadius.circular(QzBottomTabBar._pillRadius),
              ),
              child: Icon(
                spec.icon,
                key: ValueKey<String>('tab-${spec.keyName}'),
                size: 20,
                color: fg,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              spec.label,
              style: TextStyle(
                fontSize: 10,
                height: 1.2,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                letterSpacing: 0.2,
                color: fg,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
