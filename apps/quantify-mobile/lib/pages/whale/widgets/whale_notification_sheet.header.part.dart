part of 'whale_notification_sheet.dart';
// ignore_for_file: unused_element

/// 把 panel 顶到屏幕顶部、限制最大高度接近设计稿首屏覆盖比例。
class _PanelHost extends StatelessWidget {
  const _PanelHost({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final MediaQueryData media = MediaQuery.of(context);
    final double maxH = media.size.height * 0.78;
    return Material(
      color: Colors.transparent,
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxH),
          child: SizedBox(width: double.infinity, child: child),
        ),
      ),
    );
  }
}

class _WhaleNotificationSheetState extends State<WhaleNotificationSheet> {
  late List<WhaleNotification> _items;
  int _tabIndex = 0;

  @override
  void initState() {
    super.initState();
    _items = List<WhaleNotification>.of(widget.initial);
  }

  void _markAllRead() {
    setState(() {
      _items = _items
          .map((WhaleNotification n) => n.copyWith(unread: false))
          .toList();
    });
  }

  void _close() {
    Navigator.of(context).pop(WhaleNotificationSheetResult(_items));
  }

  List<WhaleNotification> _filterByIndex(
    List<WhaleNotification> items,
    int index,
  ) {
    switch (index) {
      case 1:
        return items
            .where(
              (WhaleNotification n) => n.kind == WhaleNotificationKind.alert,
            )
            .toList();
      case 2:
        return items
            .where(
              (WhaleNotification n) => n.kind == WhaleNotificationKind.watch,
            )
            .toList();
      case 3:
        return items
            .where(
              (WhaleNotification n) =>
                  n.kind == WhaleNotificationKind.flow ||
                  n.kind == WhaleNotificationKind.system,
            )
            .toList();
      default:
        return items;
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<String> tabLabels = <String>[
      l10n.whaleNotificationTabAll,
      l10n.whaleNotificationTabAlert,
      l10n.whaleNotificationTabWatch,
      l10n.whaleNotificationTabSystem,
    ];
    final List<WhaleNotification> visible = _filterByIndex(_items, _tabIndex);
    final int unread = _items.where((WhaleNotification n) => n.unread).length;
    // 单次遍历计算各 tab 计数，避免 _countOfTab(0..3) 4 次重复 filter。
    int alertCount = 0;
    int watchCount = 0;
    int flowOrSystemCount = 0;
    for (final WhaleNotification n in _items) {
      switch (n.kind) {
        case WhaleNotificationKind.alert:
          alertCount++;
        case WhaleNotificationKind.watch:
          watchCount++;
        case WhaleNotificationKind.flow:
        case WhaleNotificationKind.system:
          flowOrSystemCount++;
      }
    }
    final List<int> tabCounts = <int>[
      _items.length,
      alertCount,
      watchCount,
      flowOrSystemCount,
    ];

    return Material(
      color: Colors.transparent,
      child: Container(
        decoration: BoxDecoration(
          color: c.bgElev,
          borderRadius: const BorderRadius.vertical(
            bottom: Radius.circular(18),
          ),
          border: Border(bottom: BorderSide(color: c.borderSoft)),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: c.scrim.withValues(alpha: 0.28),
              blurRadius: 48,
              offset: const Offset(0, 24),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            SizedBox(height: _topChromeHeight(context)),
            _Header(
              unread: unread,
              onMarkAllRead: unread == 0 ? null : _markAllRead,
              onClose: _close,
            ),
            _Tabs(
              labels: tabLabels,
              counts: tabCounts,
              selected: _tabIndex,
              onTap: (int i) => setState(() => _tabIndex = i),
            ),
            Flexible(
              child: visible.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: QzSpacing.lg,
                        vertical: 36,
                      ),
                      child: Center(
                        child: Text(
                          _tabIndex == 0
                              ? l10n.whaleNotificationEmpty
                              : '暂无该类通知',
                          style: TextStyle(color: c.textDim, fontSize: 13),
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: EdgeInsets.zero,
                      itemCount: visible.length,
                      itemBuilder: (BuildContext ctx, int index) {
                        return _NotifRow(item: visible[index]);
                      },
                    ),
            ),
            _Footer(onSettings: () => _showSettingsPlaceholder(context, l10n)),
          ],
        ),
      ),
    );
  }

  void _showSettingsPlaceholder(BuildContext context, AppLocalizations l10n) {
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(
        content: Text(l10n.whaleNotificationSettings),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  double _topChromeHeight(BuildContext context) {
    final double topInset = MediaQuery.paddingOf(context).top;
    return topInset > 0 ? topInset + 4 : 54;
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.unread,
    required this.onMarkAllRead,
    required this.onClose,
  });

  final int unread;
  final VoidCallback? onMarkAllRead;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: <Widget>[
          Expanded(
            child: Row(
              children: <Widget>[
                Flexible(
                  child: Text(
                    l10n.whaleNotificationTitle,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (unread > 0) ...<Widget>[
                  const SizedBox(width: 8),
                  _UnreadBadge(count: unread),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          _MarkAllReadButton(onTap: onMarkAllRead),
          const SizedBox(width: 8),
          _CloseRoundButton(onTap: onClose),
        ],
      ),
    );
  }
}

class _UnreadBadge extends StatelessWidget {
  const _UnreadBadge({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Container(
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 7),
      decoration: BoxDecoration(
        color: c.statusDanger.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(9),
      ),
      alignment: Alignment.center,
      child: Text(
        l10n.whaleNotificationUnreadBadge(count),
        style: TextStyle(
          color: c.statusDanger,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          fontFamily: QzFont.mono,
          fontFamilyFallback: QzFont.monoFallback,
        ),
      ),
    );
  }
}

class _MarkAllReadButton extends StatelessWidget {
  const _MarkAllReadButton({required this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 26,
        padding: const EdgeInsets.symmetric(horizontal: 9),
        decoration: BoxDecoration(
          color: Colors.transparent,
          border: Border.all(color: c.borderSoft),
          borderRadius: BorderRadius.circular(13),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(Icons.check, size: 11, color: enabled ? c.textMid : c.textDim),
            const SizedBox(width: 4),
            Text(
              l10n.whaleNotificationMarkAllRead,
              style: TextStyle(
                color: enabled ? c.textMid : c.textDim,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CloseRoundButton extends StatelessWidget {
  const _CloseRoundButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Tooltip(
      message: l10n.whaleNotificationCloseTooltip,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            color: c.bgSoft,
            borderRadius: BorderRadius.circular(13),
          ),
          alignment: Alignment.center,
          child: Icon(Icons.close, size: 13, color: c.textMid),
        ),
      ),
    );
  }
}

class _Tabs extends StatelessWidget {
  const _Tabs({
    required this.labels,
    required this.counts,
    required this.selected,
    required this.onTap,
  });

  final List<String> labels;
  final List<int> counts;
  final int selected;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Align(
        alignment: Alignment.centerLeft,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: <Widget>[
              for (int i = 0; i < labels.length; i++)
                _NotifTab(
                  label: labels[i],
                  count: counts[i],
                  selected: selected == i,
                  onTap: () => onTap(i),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
