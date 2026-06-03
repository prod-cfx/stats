import 'package:flutter/material.dart';

import '../../../data/models/live_strategy_sort.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 排序选择结果（#1773）。
class LiveSortSelection {
  const LiveSortSelection(this.metric, this.direction, this.status);
  final LiveSortMetric? metric;
  final LiveSortDirection direction;
  final LiveSortStatus status;
}

enum LiveSortStatus { all, running, paused, stopped }

class LiveSortStatusCounts {
  const LiveSortStatusCounts({
    required this.all,
    required this.running,
    required this.paused,
    required this.stopped,
  });

  final int all;
  final int running;
  final int paused;
  final int stopped;

  int countOf(LiveSortStatus status) {
    switch (status) {
      case LiveSortStatus.all:
        return all;
      case LiveSortStatus.running:
        return running;
      case LiveSortStatus.paused:
        return paused;
      case LiveSortStatus.stopped:
        return stopped;
    }
  }
}

/// 筛选 & 排序 bottom sheet（#1773）。
///
/// 对齐设计稿 `m-screens-livestrats.jsx:502-604`：排序指标 pill（单选）+
/// 三态方向（升序/降序/不排序）。状态筛选仍由列表页顶部 pills 承载，这里只做
/// 排序；确认回 [LiveSortSelection]。[resultCount] 用于底部按钮「查看 N 个」。
class LiveSortSheet extends StatefulWidget {
  const LiveSortSheet({
    super.key,
    required this.metric,
    required this.direction,
    required this.status,
    required this.statusCounts,
  });

  final LiveSortMetric? metric;
  final LiveSortDirection direction;
  final LiveSortStatus status;
  final LiveSortStatusCounts statusCounts;

  /// 打开 sheet 并返回选择结果；用户取消返回 null。
  static Future<LiveSortSelection?> show(
    BuildContext context, {
    required LiveSortMetric? metric,
    required LiveSortDirection direction,
    required LiveSortStatus status,
    required LiveSortStatusCounts statusCounts,
  }) {
    return showModalBottomSheet<LiveSortSelection>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext ctx) => LiveSortSheet(
        metric: metric,
        direction: direction,
        status: status,
        statusCounts: statusCounts,
      ),
    );
  }

  @override
  State<LiveSortSheet> createState() => _LiveSortSheetState();
}

class _LiveSortSheetState extends State<LiveSortSheet> {
  late LiveSortMetric? _metric = widget.metric;
  late LiveSortDirection _direction = widget.direction;
  late LiveSortStatus _status = widget.status;

  int get _resultCount => widget.statusCounts.countOf(_status);

  void _selectMetric(LiveSortMetric m) {
    setState(() {
      _metric = m;
      if (_direction == LiveSortDirection.none) {
        _direction = LiveSortDirection.desc;
      }
    });
  }

  void _selectDirection(LiveSortDirection d) {
    setState(() {
      _direction = d;
      if (d != LiveSortDirection.none) {
        _metric ??= LiveSortMetric.todayPnl;
      }
    });
  }

  String _metricLabel(LiveSortMetric m, AppLocalizations l10n) {
    switch (m) {
      case LiveSortMetric.todayPnl:
        return l10n.liveSortMetricTodayPnl;
      case LiveSortMetric.totalPnl:
        return l10n.liveSortMetricTotalPnl;
      case LiveSortMetric.totalPct:
        return l10n.liveSortMetricTotalPct;
      case LiveSortMetric.winRate:
        return l10n.liveSortMetricWinRate;
      case LiveSortMetric.capital:
        return l10n.liveSortMetricCapital;
      case LiveSortMetric.runForDays:
        return l10n.liveSortMetricRunFor;
    }
  }

  String _statusLabel(LiveSortStatus status, AppLocalizations l10n) {
    switch (status) {
      case LiveSortStatus.all:
        return l10n.liveFilterAll;
      case LiveSortStatus.running:
        return l10n.liveFilterRunning;
      case LiveSortStatus.paused:
        return l10n.liveFilterPaused;
      case LiveSortStatus.stopped:
        return l10n.liveFilterStopped;
    }
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EdgeInsets safe = MediaQuery.viewPaddingOf(context);

    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: QzShadow.lightLg,
      ),
      padding: EdgeInsets.fromLTRB(20, 0, 20, 28 + safe.bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Center(
            child: Container(
              width: 42,
              height: 4,
              margin: const EdgeInsets.only(top: 10, bottom: 14),
              decoration: BoxDecoration(
                color: c.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Text(
            l10n.liveSortSheetTitle,
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            l10n.liveSortStatusLabel,
            style: TextStyle(color: c.textMid, fontSize: 11),
          ),
          const SizedBox(height: QzSpacing.xs),
          Wrap(
            spacing: QzSpacing.xs,
            runSpacing: QzSpacing.xs,
            children: <Widget>[
              for (final LiveSortStatus status in LiveSortStatus.values)
                _StatusPill(
                  key: Key('live-sort-status-${status.name}'),
                  label: _statusLabel(status, l10n),
                  count: widget.statusCounts.countOf(status),
                  selected: _status == status,
                  scheme: c,
                  onTap: () => setState(() => _status = status),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            l10n.liveSortMetricLabel,
            style: TextStyle(color: c.textMid, fontSize: 11),
          ),
          const SizedBox(height: QzSpacing.xs),
          Wrap(
            spacing: QzSpacing.xs,
            runSpacing: QzSpacing.xs,
            children: <Widget>[
              for (final LiveSortMetric m in LiveSortMetric.values)
                _SortPill(
                  key: Key('live-sort-metric-${m.name}'),
                  label: _metricLabel(m, l10n),
                  selected: _metric == m,
                  scheme: c,
                  onTap: () => _selectMetric(m),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            l10n.liveSortDirectionLabel,
            style: TextStyle(color: c.textMid, fontSize: 11),
          ),
          const SizedBox(height: QzSpacing.xs),
          Row(
            children: <Widget>[
              _DirCell(
                label: l10n.liveSortDirAsc,
                arrow: '↑',
                selected: _direction == LiveSortDirection.asc,
                scheme: c,
                onTap: () => _selectDirection(LiveSortDirection.asc),
              ),
              const SizedBox(width: QzSpacing.xs),
              _DirCell(
                label: l10n.liveSortDirDesc,
                arrow: '↓',
                selected: _direction == LiveSortDirection.desc,
                scheme: c,
                onTap: () => _selectDirection(LiveSortDirection.desc),
              ),
              const SizedBox(width: QzSpacing.xs),
              _DirCell(
                label: l10n.liveSortDirNone,
                arrow: '',
                selected: _direction == LiveSortDirection.none,
                scheme: c,
                onTap: () => _selectDirection(LiveSortDirection.none),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _ApplyButton(
            key: const Key('live-sort-apply'),
            label: l10n.liveSortApply(_resultCount),
            onTap: () => Navigator.of(
              context,
            ).pop(LiveSortSelection(_metric, _direction, _status)),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({
    super.key,
    required this.label,
    required this.count,
    required this.selected,
    required this.scheme,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final QzColorScheme scheme;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final BorderRadius radius = BorderRadius.circular(QzRadii.pill);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: radius,
        child: Container(
          height: 30,
          padding: const EdgeInsets.symmetric(horizontal: 13),
          decoration: BoxDecoration(
            color: selected ? scheme.accent : scheme.bgSoft,
            borderRadius: radius,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: <Widget>[
              Text(
                label,
                style: TextStyle(
                  color: selected ? Colors.white : scheme.text,
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
              const SizedBox(width: 5),
              Text(
                '$count',
                style: TextStyle(
                  color: selected
                      ? Colors.white.withValues(alpha: 0.75)
                      : scheme.textDim,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SortPill extends StatelessWidget {
  const _SortPill({
    super.key,
    required this.label,
    required this.selected,
    required this.scheme,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final QzColorScheme scheme;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final BorderRadius radius = BorderRadius.circular(QzRadii.pill);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: radius,
        child: Container(
          height: 32,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: selected ? scheme.accent : scheme.bgSoft,
            borderRadius: radius,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: <Widget>[
              Text(
                label,
                style: TextStyle(
                  color: selected ? Colors.white : scheme.text,
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ApplyButton extends StatelessWidget {
  const _ApplyButton({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 46,
          decoration: BoxDecoration(
            gradient: c.accentGrad,
            borderRadius: BorderRadius.circular(12),
            boxShadow: <BoxShadow>[c.accentShadow],
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _DirCell extends StatelessWidget {
  const _DirCell({
    required this.label,
    required this.arrow,
    required this.selected,
    required this.scheme,
    required this.onTap,
  });
  final String label;
  final String arrow;
  final bool selected;
  final QzColorScheme scheme;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final BorderRadius radius = BorderRadius.circular(10);
    return Expanded(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: Container(
            height: 40,
            decoration: BoxDecoration(
              color: selected ? scheme.accentSoft : scheme.bgSoft,
              border: Border.all(
                color: selected ? scheme.accent : Colors.transparent,
              ),
              borderRadius: radius,
            ),
            alignment: Alignment.center,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Text(
                  label,
                  style: TextStyle(
                    color: selected ? scheme.accent : scheme.text,
                    fontSize: 12.5,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
                if (arrow.isNotEmpty) ...<Widget>[
                  const SizedBox(width: 4),
                  Text(
                    arrow,
                    style: TextStyle(
                      color: selected ? scheme.accent : scheme.text,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      fontFamily: QzFont.mono,
                      fontFamilyFallback: QzFont.monoFallback,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
