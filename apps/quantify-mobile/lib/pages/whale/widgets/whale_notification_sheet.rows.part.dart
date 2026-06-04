part of 'whale_notification_sheet.dart';
// ignore_for_file: unused_element

class _NotifTab extends StatelessWidget {
  const _NotifTab({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.fromLTRB(4, 8, 4, 10),
        margin: const EdgeInsets.only(right: 6),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: selected ? c.accent : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              label,
              style: TextStyle(
                color: selected ? c.text : c.textMid,
                fontSize: 12,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
            const SizedBox(width: 5),
            Text(
              '$count',
              style: TextStyle(
                color: selected ? c.accent : c.textDim,
                fontSize: 10,
                fontWeight: FontWeight.w600,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotifRow extends StatelessWidget {
  const _NotifRow({required this.item});
  final WhaleNotification item;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final _KindPalette palette = _palette(c);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: item.unread ? c.accentSoft : Colors.transparent,
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: <Widget>[
          if (item.unread)
            Positioned(
              left: -10,
              top: 6,
              child: Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: c.accent,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: palette.bg,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(palette.icon, size: 15, color: palette.accent),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Text(
                          _kindLabel(l10n, item.kind),
                          style: TextStyle(
                            color: palette.accent,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                        if (item.address != null) ...<Widget>[
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              '· ${item.address}',
                              style: TextStyle(
                                color: c.textDim,
                                fontSize: 10,
                                fontFamily: QzFont.mono,
                                fontFamilyFallback: QzFont.monoFallback,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.title,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                        letterSpacing: -0.1,
                      ),
                    ),
                    const SizedBox(height: 3),
                    _BodyText(item: item),
                    const SizedBox(height: 6),
                    Text(
                      item.meta,
                      style: TextStyle(color: c.textDim, fontSize: 10),
                    ),
                    if (item.actions.isNotEmpty) ...<Widget>[
                      const SizedBox(height: 8),
                      _NotificationActions(actions: item.actions),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _kindLabel(AppLocalizations l10n, WhaleNotificationKind kind) {
    switch (kind) {
      case WhaleNotificationKind.alert:
        return l10n.whaleNotifKindAlert;
      case WhaleNotificationKind.watch:
        return l10n.whaleNotifKindWatch;
      case WhaleNotificationKind.flow:
        return l10n.whaleNotifKindFlow;
      case WhaleNotificationKind.system:
        return l10n.whaleNotifKindSystem;
    }
  }

  _KindPalette _palette(QzColorScheme c) {
    switch (item.kind) {
      case WhaleNotificationKind.alert:
        return _KindPalette(
          icon: Icons.warning_amber,
          accent: c.statusWarn,
          bg: c.statusWarn.withValues(alpha: 0.14),
        );
      case WhaleNotificationKind.watch:
        return _KindPalette(
          icon: Icons.visibility,
          accent: c.accent,
          bg: c.accentSoft,
        );
      case WhaleNotificationKind.flow:
        return _KindPalette(
          icon: Icons.trending_up,
          accent: c.statusInfo,
          bg: c.statusInfo.withValues(alpha: 0.14),
        );
      case WhaleNotificationKind.system:
        return _KindPalette(
          icon: Icons.schedule,
          accent: c.textMid,
          bg: c.bgSoft,
        );
    }
  }
}

class _BodyText extends StatelessWidget {
  const _BodyText({required this.item});
  final WhaleNotification item;

  static final RegExp _highlightPattern = RegExp(
    r'(\+\$?[\d,]+(?:\.\d+)?\s?\w*|\$[\d.,]+M|-\$?[\d,]+(?:\.\d+)?\s?\w*|\d+(?:\.\d+)?×)',
  );

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final TextStyle base = TextStyle(
      color: c.textMid,
      fontSize: 12,
      height: 1.45,
    );
    final Color? toneColor = switch (item.tone) {
      'up' => c.marketUp,
      'dn' => c.marketDown,
      _ => null,
    };

    if (toneColor == null) {
      return Text(item.body, style: base);
    }

    final List<InlineSpan> spans = <InlineSpan>[];
    int cursor = 0;
    for (final RegExpMatch match in _highlightPattern.allMatches(item.body)) {
      if (match.start > cursor) {
        spans.add(TextSpan(text: item.body.substring(cursor, match.start)));
      }
      spans.add(
        TextSpan(
          text: match.group(0),
          style: TextStyle(
            color: toneColor,
            fontWeight: FontWeight.w600,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      );
      cursor = match.end;
    }
    if (cursor < item.body.length) {
      spans.add(TextSpan(text: item.body.substring(cursor)));
    }

    return RichText(
      text: TextSpan(style: base, children: spans),
      textScaler: MediaQuery.textScalerOf(context),
    );
  }
}

class _NotificationActions extends StatelessWidget {
  const _NotificationActions({required this.actions});
  final List<String> actions;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        for (int i = 0; i < actions.length; i++) ...<Widget>[
          if (i > 0) const SizedBox(width: 6),
          _NotificationActionButton(label: actions[i], primary: i == 0),
        ],
      ],
    );
  }
}

class _NotificationActionButton extends StatelessWidget {
  const _NotificationActionButton({required this.label, required this.primary});
  final String label;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      height: 26,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      constraints: const BoxConstraints(minWidth: 0),
      decoration: BoxDecoration(
        color: primary ? c.text : Colors.transparent,
        border: primary ? null : Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(13),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: TextStyle(
          color: primary ? c.bgElev : c.textMid,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _KindPalette {
  const _KindPalette({
    required this.icon,
    required this.accent,
    required this.bg,
  });
  final IconData icon;
  final Color accent;
  final Color bg;
}

class _Footer extends StatelessWidget {
  const _Footer({required this.onSettings});
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(top: BorderSide(color: c.borderSoft)),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(18)),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              l10n.whaleNotificationFooterHint,
              style: TextStyle(color: c.textDim, fontSize: 11),
            ),
          ),
          GestureDetector(
            onTap: onSettings,
            behavior: HitTestBehavior.opaque,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(Icons.tune, size: 13, color: c.accent),
                const SizedBox(width: 4),
                Text(
                  l10n.whaleNotificationSettings,
                  style: TextStyle(
                    color: c.accent,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
