import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/live_strategy_models.dart';
import '../../data/models/live_strategy_sort.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_chip.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_top_bar.dart';
import 'widgets/live_action_sheet.dart';
import 'widgets/live_close_with_position_sheet.dart';
import 'widgets/live_delete_sheet.dart';
import 'widgets/live_need_pause_sheet.dart';
import 'widgets/live_sort_sheet.dart';
import 'widgets/live_strategy_card.dart';

/// 实盘策略列表页（#1752，`/me/live`）。
///
/// 入口：「我的」页「实盘策略」行 / AI 部署成功态。受 `/me` 前缀登录守卫。
/// 结构对齐设计稿 `ScreenLiveStrats`：聚合卡 → filter pills → 策略卡列表。
/// 排序入口打开「筛选 & 排序」bottom sheet（#1773），选择会话内持久化。
class LiveStrategiesPage extends ConsumerStatefulWidget {
  const LiveStrategiesPage({super.key});

  @override
  ConsumerState<LiveStrategiesPage> createState() => _LiveStrategiesPageState();
}

/// filter chip 与状态的映射。null = 全部（排除 stopped）。
enum _LiveFilter { all, running, paused, stopped }

class _LiveStrategiesPageState extends ConsumerState<LiveStrategiesPage> {
  _LiveFilter _filter = _LiveFilter.all;
  LiveSortMetric? _sortMetric;
  LiveSortDirection _sortDir = LiveSortDirection.none;

  bool _matches(LiveStrategy s) {
    switch (_filter) {
      case _LiveFilter.all:
        return s.status != LiveStrategyStatus.stopped;
      case _LiveFilter.running:
        return s.status == LiveStrategyStatus.running;
      case _LiveFilter.paused:
        return s.status == LiveStrategyStatus.paused;
      case _LiveFilter.stopped:
        return s.status == LiveStrategyStatus.stopped;
    }
  }

  Future<void> _openSortSheet(AsyncValue<List<LiveStrategy>> strategies) async {
    final LiveSortStatusCounts counts = strategies.maybeWhen(
      data: _statusCounts,
      orElse: () =>
          const LiveSortStatusCounts(all: 0, running: 0, paused: 0, stopped: 0),
    );
    final LiveSortSelection? result = await LiveSortSheet.show(
      context,
      metric: _sortMetric,
      direction: _sortDir,
      status: _sortStatusFromFilter(_filter),
      statusCounts: counts,
    );
    if (result == null || !mounted) return;
    setState(() {
      _filter = _filterFromSortStatus(result.status);
      _sortMetric = result.metric;
      _sortDir = result.direction;
    });
  }

  LiveSortStatusCounts _statusCounts(List<LiveStrategy> all) {
    return LiveSortStatusCounts(
      all: all
          .where((LiveStrategy s) => s.status != LiveStrategyStatus.stopped)
          .length,
      running: all
          .where((LiveStrategy s) => s.status == LiveStrategyStatus.running)
          .length,
      paused: all
          .where((LiveStrategy s) => s.status == LiveStrategyStatus.paused)
          .length,
      stopped: all
          .where((LiveStrategy s) => s.status == LiveStrategyStatus.stopped)
          .length,
    );
  }

  LiveSortStatus _sortStatusFromFilter(_LiveFilter filter) {
    switch (filter) {
      case _LiveFilter.all:
        return LiveSortStatus.all;
      case _LiveFilter.running:
        return LiveSortStatus.running;
      case _LiveFilter.paused:
        return LiveSortStatus.paused;
      case _LiveFilter.stopped:
        return LiveSortStatus.stopped;
    }
  }

  _LiveFilter _filterFromSortStatus(LiveSortStatus status) {
    switch (status) {
      case LiveSortStatus.all:
        return _LiveFilter.all;
      case LiveSortStatus.running:
        return _LiveFilter.running;
      case LiveSortStatus.paused:
        return _LiveFilter.paused;
      case LiveSortStatus.stopped:
        return _LiveFilter.stopped;
    }
  }

  /// footer 主操作：running → 暂停（有持仓先弹处理对话框）；其余 → 开启/恢复。
  /// 复用详情页 `_StickyAction` 同款 store + sheet 链路（#1773），口径保持一致。
  Future<void> _onToggle(LiveStrategy s) async {
    final LiveStrategyStore store = ref.read(
      liveStrategyStoreProvider.notifier,
    );
    if (s.status == LiveStrategyStatus.running) {
      await _pauseRunning(s, store);
      return;
    }
    store.resume(s.id);
  }

  Future<void> _pauseRunning(LiveStrategy s, LiveStrategyStore store) async {
    final LiveStrategyPosition? position = await ref.read(
      liveStrategyPositionProvider(s.id).future,
    );
    if (!mounted) return;
    if (position == null) {
      store.pause(s.id);
      return;
    }
    final LivePauseMode? mode = await LiveCloseWithPositionSheet.show(
      context,
      strategy: s,
      position: position,
    );
    if (mode == null) return;
    store.pause(s.id);
  }

  Future<void> _onAskDelete(LiveStrategy s) async {
    final LiveStrategyStore store = ref.read(
      liveStrategyStoreProvider.notifier,
    );
    if (s.status == LiveStrategyStatus.running) {
      final bool? goPause = await LiveNeedPauseSheet.show(
        context,
        name: s.name,
      );
      if (goPause != true || !mounted) return;
      await _pauseRunning(s, store);
      return;
    }
    final bool stopped = s.status == LiveStrategyStatus.stopped;
    final bool? permanent = await LiveDeleteSheet.show(
      context,
      name: s.name,
      stopped: stopped,
    );
    if (permanent == null || !mounted) return;
    if (permanent) {
      store.permanentDelete(s.id);
    } else {
      store.softDelete(s.id);
    }
  }

  Future<void> _onOpenMenu(LiveStrategy s) async {
    final LiveActionSheetResult? action = await LiveActionSheet.show(
      context,
      strategy: s,
    );
    if (action == null || !mounted) return;
    switch (action) {
      case LiveActionSheetResult.view:
        context.push('/me/live/${s.id}');
      case LiveActionSheetResult.toggle:
        await _onToggle(s);
      case LiveActionSheetResult.delete:
        await _onAskDelete(s);
    }
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AsyncValue<List<LiveStrategy>> strategies = ref.watch(
      liveStrategiesProvider,
    );
    final AsyncValue<LiveStrategySummary> summary = ref.watch(
      liveStrategySummaryProvider,
    );

    return Scaffold(
      backgroundColor: c.bg,
      appBar: QzTopBar(
        title: l10n.liveListTitle,
        onBack: () => context.pop(),
        actions: <Widget>[
          IconButton(
            key: const Key('live-sort-button'),
            icon: const Icon(Icons.tune, size: 20),
            color: _sortDir == LiveSortDirection.none ? c.textDim : c.accent,
            onPressed: () => _openSortSheet(strategies),
            tooltip: l10n.liveSortSheetTitle,
          ),
        ],
      ),
      body: strategies.when(
        loading: () => const Center(child: QzSpinner()),
        error: (Object e, StackTrace _) => Center(
          child: Text(
            l10n.liveLoadError,
            style: TextStyle(color: c.statusDanger),
          ),
        ),
        data: (List<LiveStrategy> list) =>
            _content(context, l10n, c, list, summary),
      ),
    );
  }

  Widget _content(
    BuildContext context,
    AppLocalizations l10n,
    QzColorScheme c,
    List<LiveStrategy> all,
    AsyncValue<LiveStrategySummary> summary,
  ) {
    final List<LiveStrategy> filtered = all
        .where(_matches)
        .toList(growable: false);
    final List<LiveStrategy> visible = sortStrategies(
      filtered,
      _sortMetric,
      _sortDir,
    );

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.md,
        QzSpacing.lg,
        QzSpacing.xxl * 2,
      ),
      children: <Widget>[
        summary.maybeWhen(
          data: (LiveStrategySummary s) => _SummaryCard(summary: s),
          orElse: () => const SizedBox.shrink(),
        ),
        const SizedBox(height: QzSpacing.md),
        _FilterPills(
          filter: _filter,
          all: all,
          onChanged: (_LiveFilter f) => setState(() => _filter = f),
        ),
        const SizedBox(height: QzSpacing.md),
        if (_filter == _LiveFilter.stopped && visible.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: QzSpacing.md),
            child: _RetentionHint(text: l10n.liveStoppedRetentionHint),
          ),
        if (visible.isEmpty)
          _EmptyState(l10n: l10n)
        else
          ...visible.map(
            (LiveStrategy s) => LiveStrategyCard(
              key: Key('live-card-${s.id}'),
              strategy: s,
              onTap: () => context.push('/me/live/${s.id}'),
              onToggle: () => _onToggle(s),
              onOpenMenu: () => _onOpenMenu(s),
            ),
          ),
        if (visible.isNotEmpty) _CreateFromAiButton(l10n: l10n),
      ],
    );
  }
}

class _CreateFromAiButton extends StatelessWidget {
  const _CreateFromAiButton({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.only(top: QzSpacing.xs),
      child: CustomPaint(
        painter: _DashedRoundRectPainter(
          color: c.border,
          radius: 12,
          strokeWidth: 1.5,
        ),
        child: SizedBox(
          height: 46,
          child: Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(Icons.add_rounded, size: 16, color: c.textMid),
                const SizedBox(width: QzSpacing.xs),
                Text(
                  l10n.liveCreateFromAi,
                  style: TextStyle(
                    color: c.textMid,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
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

class _DashedRoundRectPainter extends CustomPainter {
  const _DashedRoundRectPainter({
    required this.color,
    required this.radius,
    required this.strokeWidth,
  });

  final Color color;
  final double radius;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;
    final RRect rect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        strokeWidth / 2,
        strokeWidth / 2,
        size.width - strokeWidth,
        size.height - strokeWidth,
      ),
      Radius.circular(radius),
    );
    final Path path = Path()..addRRect(rect);
    for (final metric in path.computeMetrics()) {
      double distance = 0;
      while (distance < metric.length) {
        final double next = (distance + 6).clamp(0, metric.length);
        canvas.drawPath(metric.extractPath(distance, next), paint);
        distance += 10;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedRoundRectPainter oldDelegate) =>
      oldDelegate.color != color ||
      oldDelegate.radius != radius ||
      oldDelegate.strokeWidth != strokeWidth;
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.summary});
  final LiveStrategySummary summary;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool up = summary.totalPnl >= 0;
    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.liveListTotalAssets,
            style: TextStyle(color: c.textDim, fontSize: 11),
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Flexible(
                child: Text(
                  '\$${summary.totalAssets.toStringAsFixed(2)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              QzChip(
                label:
                    '${up ? '+' : ''}${summary.totalPct.toStringAsFixed(2)}%',
                tone: up ? QzChipTone.ok : QzChipTone.danger,
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Row(
            children: <Widget>[
              Expanded(
                child: _AggStat(
                  label: l10n.liveListTodayPnl,
                  value: _money(summary.todayPnl),
                  color: summary.todayPnl >= 0 ? c.marketUp : c.marketDown,
                ),
              ),
              Expanded(
                child: _AggStat(
                  label: l10n.liveListTotalPnl,
                  value: _money(summary.totalPnl),
                  color: up ? c.marketUp : c.marketDown,
                ),
              ),
              Expanded(
                child: _AggStat(
                  label: l10n.liveListCapital,
                  value: '\$${summary.totalCapital.toStringAsFixed(0)}',
                  color: c.text,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _money(double v) =>
      '${v >= 0 ? '+\$' : '-\$'}${v.abs().toStringAsFixed(2)}';
}

class _AggStat extends StatelessWidget {
  const _AggStat({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: TextStyle(color: c.textDim, fontSize: 11)),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 14,
            fontWeight: FontWeight.w700,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _FilterPills extends StatelessWidget {
  const _FilterPills({
    required this.filter,
    required this.all,
    required this.onChanged,
  });
  final _LiveFilter filter;
  final List<LiveStrategy> all;
  final ValueChanged<_LiveFilter> onChanged;

  int _count(_LiveFilter f) {
    switch (f) {
      case _LiveFilter.all:
        return all.length;
      case _LiveFilter.running:
        return all
            .where((LiveStrategy s) => s.status == LiveStrategyStatus.running)
            .length;
      case _LiveFilter.paused:
        return all
            .where((LiveStrategy s) => s.status == LiveStrategyStatus.paused)
            .length;
      case _LiveFilter.stopped:
        return all
            .where((LiveStrategy s) => s.status == LiveStrategyStatus.stopped)
            .length;
    }
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<(_LiveFilter, String)> items = <(_LiveFilter, String)>[
      (_LiveFilter.all, l10n.liveFilterAll),
      (_LiveFilter.running, l10n.liveFilterRunning),
      (_LiveFilter.paused, l10n.liveFilterPaused),
      (_LiveFilter.stopped, l10n.liveFilterStopped),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: <Widget>[
          for (final (_LiveFilter, String) it in items)
            Padding(
              padding: const EdgeInsets.only(right: QzSpacing.xs),
              child: _Pill(
                label: '${it.$2} ${_count(it.$1)}',
                selected: filter == it.$1,
                scheme: c,
                onTap: () => onChanged(it.$1),
              ),
            ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
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
          padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
          decoration: BoxDecoration(
            color: selected ? scheme.accentSoft : scheme.bgElev,
            border: Border.all(
              color: selected ? scheme.accentRing : scheme.border,
            ),
            borderRadius: radius,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: selected ? scheme.accent : scheme.textMid,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

class _RetentionHint extends StatelessWidget {
  const _RetentionHint({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: 10,
      ),
      decoration: BoxDecoration(
        color: c.statusWarn.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        text,
        style: TextStyle(color: c.statusWarn, fontSize: 11, height: 1.55),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: QzSpacing.xxl * 2),
      child: Column(
        children: <Widget>[
          Icon(Icons.show_chart, size: 40, color: c.textDim),
          const SizedBox(height: QzSpacing.md),
          Text(
            l10n.liveEmptyTitle,
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: QzSpacing.xs),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: QzSpacing.xl),
            child: Text(
              l10n.liveEmptyHint,
              textAlign: TextAlign.center,
              style: TextStyle(color: c.textMid, fontSize: 12, height: 1.5),
            ),
          ),
        ],
      ),
    );
  }
}
