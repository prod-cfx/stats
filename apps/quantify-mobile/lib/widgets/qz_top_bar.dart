import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';

/// Top app bar matching the mobile prototype's `MTopBar`
/// (`design/project/mobile/m-shell.jsx:144`).
///
/// Implemented as a [PreferredSizeWidget] so callers can drop it into
/// `Scaffold.appBar`. The reported [preferredSize] is the *toolbar* height
/// (56dp); status-bar inset is added by [Scaffold] itself via the AppBar
/// slot's wrapping [SafeArea], which means body content offsets correctly
/// even on devices with a notch. Do not wrap this widget in an additional
/// `SafeArea(top: true)` outside `Scaffold.appBar` — that would double-pad.
class QzTopBar extends StatelessWidget implements PreferredSizeWidget {
  const QzTopBar({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.actions = const <Widget>[],
    this.onBack,
    this.transparent = false,
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

    // Body content sits *under* preferredSize. We expose the static toolbar
    // height (56dp) here and let Scaffold's AppBar slot allocate the status
    // bar inset on top of it — that's the contract Scaffold checks. The
    // toolbar paints below the status bar because we wrap it in SafeArea
    // *outside* this PreferredSizeWidget when host code uses Scaffold.appBar
    // (Scaffold does this automatically for any AppBar-shaped widget).
    return Container(
      height: _toolbarHeight,
      decoration: BoxDecoration(
        color: transparent ? Colors.transparent : c.bgElev,
        border: transparent
            ? null
            : Border(
                bottom: BorderSide(color: c.borderSoft),
              ),
      ),
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
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                    if (subtitle != null) ...<Widget>[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: c.textDim,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            ...actions,
            // Symmetric right padding so the title doesn't kiss the screen
            // edge when [actions] is empty.
            const SizedBox(width: 8),
          ],
        ),
      );
  }
}
