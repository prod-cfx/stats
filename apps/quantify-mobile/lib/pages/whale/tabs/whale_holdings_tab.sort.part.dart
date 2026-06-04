part of 'whale_holdings_tab.dart';
// ignore_for_file: unused_element

/// 排序抽屉「完成」回传值。[sort] 为 null 表示选择了「不排序」；点遮罩取消
/// 时 sheet 返回 null（而非 [_SortResult]），调用方据此区分取消与不排序。
class _SortResult {
  const _SortResult(this.sort);

  final WhaleHoldingSort? sort;
}

/// 更多排序底部抽屉：指标三选一 + 排序方式三选一（升序/降序/不排序）。
class _SortSheet {
  const _SortSheet._();

  static Future<_SortResult?> show({
    required BuildContext context,
    required WhaleHoldingSort? current,
  }) {
    final QzColorScheme c = context.qzScheme;
    return showModalBottomSheet<_SortResult>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: c.bgElev,
      barrierColor: c.scrim,
      sheetAnimationStyle: const AnimationStyle(
        curve: QzCurves.sheetPanel,
        duration: QzCurves.sheetPanelDuration,
        reverseCurve: QzCurves.sheetPanel,
        reverseDuration: QzCurves.sheetPanelDuration,
      ),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (BuildContext ctx) {
        final QzColorScheme sheetColors = ctx.qzScheme;
        final double keyboardInset = MediaQuery.viewInsetsOf(ctx).bottom;
        return SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.only(bottom: math.max(28, keyboardInset)),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                const SizedBox(height: 10),
                Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: sheetColors.borderStrong,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 14),
                _SortSheetBody(current: current),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SortSheetBody extends StatefulWidget {
  const _SortSheetBody({required this.current});

  final WhaleHoldingSort? current;

  @override
  State<_SortSheetBody> createState() => _SortSheetBodyState();
}

class _SortSheetBodyState extends State<_SortSheetBody> {
  late WhaleHoldingSortKey _key;
  // null 表示「不排序」。
  late WhaleHoldingSortDir? _dir;

  @override
  void initState() {
    super.initState();
    _key = widget.current?.key ?? WhaleHoldingSortKey.value;
    _dir = widget.current?.dir;
  }

  String _keyLabel(AppLocalizations l10n, WhaleHoldingSortKey key) {
    switch (key) {
      case WhaleHoldingSortKey.value:
        return l10n.whaleHoldingsSortValue;
      case WhaleHoldingSortKey.margin:
        return l10n.whaleHoldingsSortMargin;
      case WhaleHoldingSortKey.time:
        return l10n.whaleHoldingsSortTime;
    }
  }

  void _done() {
    final WhaleHoldingSort? sort = _dir == null
        ? null
        : WhaleHoldingSort(key: _key, dir: _dir!);
    Navigator.of(context).pop(_SortResult(sort));
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.whaleHoldingsMoreSort,
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            l10n.whaleHoldingsSortSectionMetric,
            style: TextStyle(color: c.textMid, fontSize: 11),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: <Widget>[
              for (final WhaleHoldingSortKey key in WhaleHoldingSortKey.values)
                _SortPill(
                  key: Key('whaleHoldingsSortKey_${key.name}'),
                  label: _keyLabel(l10n, key),
                  active: _key == key,
                  onTap: () => setState(() => _key = key),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            l10n.whaleHoldingsSortSectionDir,
            style: TextStyle(color: c.textMid, fontSize: 11),
          ),
          const SizedBox(height: 6),
          Row(
            children: <Widget>[
              Expanded(
                child: _SortDirCell(
                  key: const Key('whaleHoldingsSortDirAsc'),
                  label: l10n.whaleHoldingsSortDirAsc,
                  arrow: '↑',
                  active: _dir == WhaleHoldingSortDir.asc,
                  onTap: () => setState(() => _dir = WhaleHoldingSortDir.asc),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: _SortDirCell(
                  key: const Key('whaleHoldingsSortDirDesc'),
                  label: l10n.whaleHoldingsSortDirDesc,
                  arrow: '↓',
                  active: _dir == WhaleHoldingSortDir.desc,
                  onTap: () => setState(() => _dir = WhaleHoldingSortDir.desc),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: _SortDirCell(
                  key: const Key('whaleHoldingsSortDirNone'),
                  label: l10n.whaleHoldingsSortDirNone,
                  arrow: '',
                  active: _dir == null,
                  onTap: () => setState(() => _dir = null),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          GestureDetector(
            key: const Key('whaleHoldingsSortDone'),
            behavior: HitTestBehavior.opaque,
            onTap: _done,
            child: Container(
              width: double.infinity,
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                gradient: c.accentGrad,
                borderRadius: BorderRadius.circular(12),
                boxShadow: <BoxShadow>[c.accentShadow],
              ),
              child: Text(
                l10n.whaleHoldingsSortDone,
                style: const TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SortPill extends StatelessWidget {
  const _SortPill({
    required this.label,
    required this.active,
    required this.onTap,
    super.key,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: active ? c.accent : c.bgSoft,
          borderRadius: BorderRadius.circular(QzRadii.pill),
        ),
        child: Align(
          widthFactor: 1,
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: active ? c.accentOn : c.text,
              fontSize: 12,
              fontWeight: active ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

class _SortDirCell extends StatelessWidget {
  const _SortDirCell({
    required this.label,
    required this.arrow,
    required this.active,
    required this.onTap,
    super.key,
  });

  final String label;
  final String arrow;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 40,
        decoration: BoxDecoration(
          color: active ? c.accentSoft : c.bgSoft,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: active ? c.accent : Colors.transparent),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              label,
              style: TextStyle(
                color: active ? c.accent : c.text,
                fontSize: 12.5,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
            if (arrow.isNotEmpty) ...<Widget>[
              const SizedBox(width: 5),
              Text(
                arrow,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: active ? c.accent : c.text,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
