import 'dart:ui';

import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../theme/colors.dart';
import '../theme/theme_context.dart';
import 'qz_tab_icon.dart';

/// Bottom tab bar matching the `MTabBar` design (`design/project/mobile/m-shell.jsx`).
///
/// Visual contract:
/// - 5 fixed items in this canonical order (left → right), each tagged with a
///   stable `ValueKey('tab-<name>')`:
///     0. `tab-strategy` — 策略
///     1. `tab-ai`       — AI 量化
///     2. `tab-market`   — 行情
///     3. `tab-whale`    — 巨鲸
///     4. `tab-me`       — 我的
///   This order is the single source of truth, mirrored by router branches in
///   `lib/router/app_router.dart` and guarded by
///   `test/widgets/qz_bottom_tab_bar_test.dart` (visual order) +
///   `test/router/app_router_test.dart` (index → page mapping).
/// - Active tab shows a 42x28 rounded pill behind the icon, filled with
///   `scheme.accentSoft`; inactive items have a transparent pill slot.
/// - Active color = `scheme.accent`; inactive = `scheme.textDim`.
/// - Background = real frosted-glass effect: a [BackdropFilter] applies
///   `ImageFilter.blur(sigmaX/Y: 18)` (≈ CSS `blur(16px)`) clipped to the bar
///   bounds via [ClipRect], with `scheme.tabBlur` as the semi-transparent
///   tint overlay; a 1px top border uses `scheme.borderSoft`. The blur samples
///   whatever scroll content sits behind via [Scaffold.extendBody].
///
///   **Tech-debt conclusion (#1798): CSS `saturate(180%)` is intentionally not
///   ported.** Flutter's [BackdropFilter] composes a single [ImageFilter]; the
///   design's `blur(16px) saturate(180%)` chain would need a `ColorFilter.
///   matrix` saturation pass fused with the blur, which Flutter cannot express
///   as one filter — a second full-screen backdrop pass would cost an extra
///   offscreen composite every frame on the always-visible tab bar. The
///   `scheme.tabBlur` tint already biases saturation per theme to approximate
///   the look. Conclusion: keep the blur-only approximation; do not chase an
///   exact saturate match.
/// - Preserves bottom safe-area inset for iOS home indicator.
class QzBottomTabBar extends StatelessWidget {
  static const int _tabCount = 5;
  static const double _pillWidth = 42;
  static const double _pillHeight = 28;
  static const double _pillRadius = 14;
  // Approximates CSS `blur(16px)`. Flutter's [ImageFilter.blur] sigma roughly
  // maps to CSS pixel radius * 1.1; 18 lands close to the design-spec frosted
  // look without becoming washed out at higher device pixel ratios.
  static const double _blurSigma = 18;

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
      _TabSpec(keyName: 'strategy', glyph: QzTabGlyph.strat, label: l10n.tabStrategy),
      _TabSpec(keyName: 'ai', glyph: QzTabGlyph.ai, label: 'AI 量化'),
      _TabSpec(keyName: 'market', glyph: QzTabGlyph.market, label: l10n.tabMarket),
      _TabSpec(keyName: 'whale', glyph: QzTabGlyph.whale, label: l10n.tabWhale),
      _TabSpec(keyName: 'me', glyph: QzTabGlyph.me, label: l10n.tabMe),
    ];
    return Material(
      type: MaterialType.transparency,
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: _blurSigma, sigmaY: _blurSigma),
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
        ),
      ),
    );
  }
}

class _TabSpec {
  const _TabSpec({
    required this.keyName,
    required this.glyph,
    required this.label,
  });

  final String keyName;
  final QzTabGlyph glyph;
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
              child: QzTabIcon(
                key: ValueKey<String>('tab-${spec.keyName}'),
                glyph: spec.glyph,
                active: active,
                color: fg,
                size: 20,
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
