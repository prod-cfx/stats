import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/mock/fixtures/whale_extras.dart';
import '../../../data/models/whale_models.dart';
import '../../../data/providers.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_chip.dart';
import '../../../widgets/qz_empty_state.dart';
import '../../../widgets/qz_spinner.dart';
import '../widgets/qz_whale_row.dart';
import '../widgets/whale_net_flow_card.dart';

/// 巨鲸动向 — 实时 tab body（issue #1560，原 [`WhaleFeedPage`] 拆分而来）。
///
/// 与原 page 行为一致：history `listRecent(limit: 30)` + watchFeed 推流 +
/// 700ms 高亮 + symbol/amount filter；新增顶部 hero 卡 + 时间分组渲染。
///
/// 时间分组规则：以可见条目 index 三等分到 now/15m/1h 三组，不依赖
/// fixture timestamp（mock 数据时间戳写死 2024-05，与真实墙钟差距过大会
/// 把所有条目都归到「更早」分组，从而让 feed 看上去为空）。详见 plan
/// `docs/superpowers/plans/2026-05-19-whale-4tabs-notif.md` Critic C2。
class WhaleLiveTab extends ConsumerStatefulWidget {
  const WhaleLiveTab({super.key});

  @override
  ConsumerState<WhaleLiveTab> createState() => _WhaleLiveTabState();
}

class _FeedItem {
  _FeedItem(this.event, {required this.highlight});
  final WhaleEvent event;
  bool highlight;
}

class _WhaleLiveTabState extends ConsumerState<WhaleLiveTab> {
  final List<_FeedItem> _items = <_FeedItem>[];
  StreamSubscription<WhaleEvent>? _sub;
  bool _loading = true;
  Object? _error;

  static const String _kAllSymbol = '';
  static const List<String> _symbolFilterKeys = <String>['', 'BTC', 'ETH', 'SOL'];

  String _symbolFilter = _kAllSymbol;
  double _minAmount = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _sub?.cancel();
    _sub = null;
    super.dispose();
  }

  Future<void> _load() async {
    final repo = ref.read(whaleFeedRepositoryProvider);
    try {
      final List<WhaleEvent> history = await repo.listRecent(limit: 30);
      if (!mounted) return;
      setState(() {
        _items
          ..clear()
          ..addAll(history.map((WhaleEvent e) => _FeedItem(e, highlight: false)));
        _loading = false;
      });
      _sub = repo.watchFeed().listen(_onPush);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  void _onPush(WhaleEvent event) {
    if (!_passesFilter(event)) return;
    if (!mounted) return;
    setState(() {
      _items.insert(0, _FeedItem(event, highlight: true));
    });
    Future<void>.delayed(const Duration(milliseconds: 700), () {
      if (!mounted) return;
      setState(() {
        if (_items.isNotEmpty && _items.first.event.id == event.id) {
          _items.first.highlight = false;
        }
      });
    });
  }

  bool _passesFilter(WhaleEvent e) {
    if (e.amountUsd < _minAmount) return false;
    if (_symbolFilter.isEmpty) return true;
    return e.symbol.startsWith(_symbolFilter);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<_FeedItem> visible =
        _items.where((_FeedItem it) => _passesFilter(it.event)).toList();

    if (_loading) {
      return const Center(child: QzSpinner());
    }
    if (_error != null) {
      return QzEmptyState(title: l10n.commonLoadError, subtitle: _error.toString());
    }

    return ListView(
      padding: EdgeInsets.zero,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg, QzSpacing.md, QzSpacing.lg, QzSpacing.sm),
          child: const WhaleNetFlowCard(stat: mockWhaleNetFlowBtc1h),
        ),
        _buildFilterBar(c, l10n),
        ..._buildGroupedFeed(visible, l10n, c),
        Padding(
          padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg, QzSpacing.md, QzSpacing.lg, QzSpacing.lg),
          child: _AddWatchButton(label: l10n.whaleAddWatchAddress),
        ),
      ],
    );
  }

  Widget _buildFilterBar(QzColorScheme c, AppLocalizations l10n) {
    final List<({String label, double value})> amountChoices =
        <({String label, double value})>[
      (label: l10n.whaleFilterAll, value: 0),
      (label: '≥ \$1M', value: 1_000_000),
      (label: '≥ \$5M', value: 5_000_000),
      (label: '≥ \$10M', value: 10_000_000),
    ];
    return Container(
      width: double.infinity,
      color: c.bgElev,
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.sm,
        QzSpacing.lg,
        QzSpacing.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: <Widget>[
                      for (final String s in _symbolFilterKeys) ...<Widget>[
                        GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => setState(() => _symbolFilter = s),
                          child: QzChip(
                            label: s.isEmpty ? l10n.commonAll : s,
                            tone: _symbolFilter == s
                                ? QzChipTone.accent
                                : QzChipTone.neutral,
                          ),
                        ),
                        const SizedBox(width: QzSpacing.sm),
                      ],
                    ],
                  ),
                ),
              ),
              _LivePulse(label: l10n.whaleLiveLabel),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          Row(
            children: <Widget>[
              Text(l10n.whaleThresholdLabel,
                  style: TextStyle(color: c.textMid, fontSize: 12)),
              const SizedBox(width: QzSpacing.sm),
              DropdownButton<double>(
                value: _minAmount,
                style: TextStyle(color: c.text, fontSize: 13),
                dropdownColor: c.bgElev,
                underline: const SizedBox.shrink(),
                items: <DropdownMenuItem<double>>[
                  for (final ({String label, double value}) choice
                      in amountChoices)
                    DropdownMenuItem<double>(
                      value: choice.value,
                      child: Text(choice.label),
                    ),
                ],
                onChanged: (double? v) {
                  if (v == null) return;
                  setState(() => _minAmount = v);
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  List<Widget> _buildGroupedFeed(
      List<_FeedItem> visible, AppLocalizations l10n, QzColorScheme c) {
    if (visible.isEmpty) {
      return <Widget>[
        Padding(
          padding: const EdgeInsets.symmetric(vertical: QzSpacing.xl),
          child: QzEmptyState(title: l10n.whaleFeedEmpty),
        ),
      ];
    }
    // 把可见条目按 index 三等分到 now / 15m / 1h 三组。
    final int n = visible.length;
    final int thirdA = (n / 3).ceil();
    final int thirdB = (2 * n / 3).ceil();
    final List<_FeedItem> groupNow = visible.sublist(0, thirdA);
    final List<_FeedItem> group15 = visible.sublist(thirdA, thirdB);
    final List<_FeedItem> group1h = visible.sublist(thirdB);

    final DateTime now = DateTime.now();
    final List<Widget> result = <Widget>[];

    void appendGroup(String label, List<_FeedItem> rows) {
      if (rows.isEmpty) return;
      result.add(_GroupHeader(label: label, count: rows.length));
      for (final _FeedItem item in rows) {
        result.add(QzWhaleRow(
          key: ValueKey<String>(item.event.id),
          event: item.event,
          highlight: item.highlight,
          now: now,
        ));
      }
    }

    appendGroup(l10n.whaleGroupNow, groupNow);
    appendGroup(l10n.whaleGroup15m, group15);
    appendGroup(l10n.whaleGroup1h, group1h);
    return result;
  }
}

class _GroupHeader extends StatelessWidget {
  const _GroupHeader({required this.label, required this.count});

  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      color: c.bgElev,
      padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg, QzSpacing.md, QzSpacing.lg, 6),
      child: Row(
        children: <Widget>[
          Text(
            label,
            style: TextStyle(
              color: c.textDim,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(child: Container(height: 1, color: c.borderSoft)),
          const SizedBox(width: QzSpacing.sm),
          Text(
            '$count',
            style: TextStyle(color: c.textMid, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _LivePulse extends StatelessWidget {
  const _LivePulse({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            color: c.marketUp,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(
            color: c.marketUp,
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

class _AddWatchButton extends StatelessWidget {
  const _AddWatchButton({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return SizedBox(
      width: double.infinity,
      height: 44,
      child: OutlinedButton.icon(
        onPressed: () {},
        icon: Icon(Icons.add, size: 18, color: c.textMid),
        label: Text(label, style: TextStyle(color: c.textMid, fontSize: 13)),
        style: OutlinedButton.styleFrom(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          side: BorderSide(color: c.border),
        ),
      ),
    );
  }
}
