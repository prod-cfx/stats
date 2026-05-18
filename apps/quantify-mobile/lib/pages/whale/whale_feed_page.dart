import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/whale_models.dart';
import '../../data/providers.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_chip.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_top_bar.dart';
import 'widgets/qz_whale_row.dart';

/// 巨鲸动向实时 Feed 页（issue #1511）。
///
/// 状态机：
/// - `_loading=true` → 加载初始历史（`listRecent(limit: 30)`）。
/// - 加载完成 → 订阅 `watchFeed()`；每条新事件 `insert(0, _)` 到 `_items`
///   并标记 700ms 高亮态，700ms 后清除高亮触发 [QzWhaleRow] 的 fade-out。
/// - `dispose()` 取消订阅，确保离开页面后不会泄漏（issue #1511 验收硬项）。
///
/// 筛选：
/// - Symbol chip：全部 / BTC / ETH / SOL（基于 `event.symbol` 前缀匹配）。
/// - 金额阈值 dropdown：全部 / ≥100万 / ≥500万 / ≥1000万。
///
/// 过滤决策：推流条目若不符合当前 filter **不进入列表**（同样不展示）。
/// 用户切换 filter 时仅 setState 重新计算 visible 列表，已积累的数据不丢失。
class WhaleFeedPage extends ConsumerStatefulWidget {
  const WhaleFeedPage({super.key});

  @override
  ConsumerState<WhaleFeedPage> createState() => _WhaleFeedPageState();
}

/// 内部封装：事件 + 高亮过期时间戳。高亮纯展示态，700ms 后被外层清零。
class _FeedItem {
  _FeedItem(this.event, {required this.highlight});
  final WhaleEvent event;
  bool highlight;
}

class _WhaleFeedPageState extends ConsumerState<WhaleFeedPage> {
  final List<_FeedItem> _items = <_FeedItem>[];
  StreamSubscription<WhaleEvent>? _sub;
  bool _loading = true;
  Object? _error;

  String _symbolFilter = '全部';
  double _minAmount = 0;

  static const List<String> _symbolChips = <String>[
    '全部',
    'BTC',
    'ETH',
    'SOL',
  ];
  static const List<({String label, double value})> _amountChoices =
      <({String label, double value})>[
    (label: '全部金额', value: 0),
    (label: '≥ \$1M', value: 1_000_000),
    (label: '≥ \$5M', value: 5_000_000),
    (label: '≥ \$10M', value: 10_000_000),
  ];

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
    // 700ms 后清除高亮——AnimatedContainer 自身的 duration 让 bg 颜色平滑过渡。
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
    if (_symbolFilter == '全部') return true;
    return e.symbol.startsWith(_symbolFilter);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final List<_FeedItem> visible =
        _items.where((_FeedItem it) => _passesFilter(it.event)).toList();
    return Scaffold(
      backgroundColor: c.bg,
      appBar: const QzTopBar(title: '巨鲸动向'),
      body: Column(
        children: <Widget>[
          _buildFilterBar(c),
          Expanded(
            child: _buildBody(visible),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar(QzColorScheme c) {
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
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: <Widget>[
                for (final String s in _symbolChips) ...<Widget>[
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => _symbolFilter = s),
                    child: QzChip(
                      label: s,
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
          const SizedBox(height: QzSpacing.sm),
          Row(
            children: <Widget>[
              Text('阈值:', style: TextStyle(color: c.textMid, fontSize: 12)),
              const SizedBox(width: QzSpacing.sm),
              DropdownButton<double>(
                value: _minAmount,
                style: TextStyle(color: c.text, fontSize: 13),
                dropdownColor: c.bgElev,
                underline: const SizedBox.shrink(),
                items: <DropdownMenuItem<double>>[
                  for (final ({String label, double value}) choice
                      in _amountChoices)
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

  Widget _buildBody(List<_FeedItem> visible) {
    if (_loading) return const Center(child: QzSpinner());
    if (_error != null) {
      return QzEmptyState(title: '加载失败', subtitle: _error.toString());
    }
    if (visible.isEmpty) {
      return const QzEmptyState(title: '暂无符合条件的巨鲸事件');
    }
    final DateTime now = DateTime.now();
    return ListView.builder(
      itemCount: visible.length,
      itemBuilder: (BuildContext context, int index) {
        final _FeedItem item = visible[index];
        return QzWhaleRow(
          key: ValueKey<String>(item.event.id),
          event: item.event,
          highlight: item.highlight,
          now: now,
        );
      },
    );
  }
}
