import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';

/// Top app bar matching the mobile prototype's `MTopBar`
/// (`design/project/mobile/m-shell.jsx:144`).
///
/// Implemented as a [PreferredSizeWidget] so callers can drop it into
/// `Scaffold.appBar`. Unlike Material [AppBar], `Scaffold.appBar` slot does
/// not auto-pad the *content* of an arbitrary PreferredSizeWidget for the
/// status-bar / notch — Scaffold only allocates `preferredSize.height` of
/// vertical space below the system status bar inset by using `MediaQuery`
/// top padding as part of the AppBar's effective size. To match Material
/// AppBar behavior we therefore:
///   * report `preferredSize = toolbar + status-bar inset` via [MediaQuery]
///     (so [Scaffold] reserves enough space for both),
///   * wrap the toolbar row in [SafeArea](top: true) so title/actions sit
///     below the notch instead of behind it.
class QzTopBar extends StatelessWidget implements PreferredSizeWidget {
  const QzTopBar({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.actions = const <Widget>[],
    this.onBack,
    this.transparent = false,
    this.compact = false,
  }) : assert(
          onBack == null || leading == null,
          'QzTopBar: provide either onBack or leading, not both',
        );

  static const double _toolbarHeight = 56;

  final String title;
  final String? subtitle;
  final Widget? leading;
  final List<Widget> actions;
  final VoidCallback? onBack;
  final bool transparent;

  /// 紧凑变体（设计稿 `MTopBar compact`：标题 14 / 副标题 11 / 间距 1）。
  /// 策略广场等二级页使用。
  final bool compact;

  @override
  Size get preferredSize => const Size.fromHeight(_toolbarHeight);

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Widget? resolvedLeading = onBack != null
        ? IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, size: 20),
            color: c.text,
            onPressed: onBack,
            tooltip: 'Back',
          )
        : leading;

    // [preferredSize] reports just the toolbar height (56dp). Material's
    // [Scaffold] expands that by `MediaQuery.padding.top` for the AppBar
    // slot, so visible space below the status bar matches preferredSize.
    // To make the toolbar paint *below* the notch (not behind it) we wrap
    // the row in [SafeArea](top: true, bottom: false). The Container's
    // total height becomes `status-bar inset + 56dp`, matching the slot
    // size Scaffold reserves.
    return Material(
      color: transparent ? Colors.transparent : c.bgElev,
      child: Container(
        decoration: BoxDecoration(
          border: transparent
              ? null
              : Border(
                  bottom: BorderSide(color: c.borderSoft),
                ),
        ),
        child: SafeArea(
          top: true,
          bottom: false,
          child: SizedBox(
            height: _toolbarHeight,
            child: Row(
              children: <Widget>[
                ?resolvedLeading,
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: resolvedLeading == null ? 16 : 0,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: c.text,
                            fontSize: compact ? 14 : 17,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.2,
                          ),
                        ),
                        if (subtitle != null) ...<Widget>[
                          SizedBox(height: compact ? 1 : 2),
                          Text(
                            subtitle!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: c.textDim,
                              fontSize: compact ? 11 : 12,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                ...actions,
                // Symmetric right padding so the title doesn't kiss the
                // screen edge when [actions] is empty.
                const SizedBox(width: 8),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
