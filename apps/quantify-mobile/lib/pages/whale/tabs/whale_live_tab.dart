import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/whale_models.dart';
import '../../../data/models/whale_watch_models.dart';
import '../../../data/providers.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_chip.dart';
import '../../../widgets/qz_empty_state.dart';
import '../../../widgets/qz_spinner.dart';
import '../widgets/qz_whale_row.dart';
import '../widgets/whale_watch_rule_sheet.dart';

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

/// 胜率排序状态（issue #1983）。循环：none → desc → asc → none，
/// 对齐设计稿 `m-screens-4.jsx:595` 的 winSort 行为。
enum _WinSort { none, desc, asc }

class _WhaleLiveTabState extends ConsumerState<WhaleLiveTab> {
  final List<_FeedItem> _items = <_FeedItem>[];
  StreamSubscription<WhaleEvent>? _sub;
  bool _loading = true;
  Object? _error;

  static const List<String> _symbolFilterKeys = <String>['', 'BTC', 'ETH', 'SOL'];

  /// issue #1604：默认与 hero `BTC 净流入 · 1H` 对齐，避免默认 `全部` 与 hero
  /// 状态不一致。
  String _symbolFilter = 'BTC';

  /// issue #1986：阈值改为自由文本输入，默认 500000（对齐设计稿
  /// `m-screens-4.jsx:1596-1665` 的 threshold 输入框）。`_minAmount` 由输入框
  /// 解析得到，供 feed 过滤复用。
  double _minAmount = 500_000;
  late final TextEditingController _thresholdCtrl;

  /// issue #1986：顶部「{n} 秒后更新」倒计时。固定 15s 周期循环递减，纯展示态。
  static const int _countdownStart = 15;
  int _tick = _countdownStart;
  Timer? _countdownTimer;

  /// issue #1983：胜率排序状态，默认不排序（按时间分组）。
  _WinSort _winSort = _WinSort.none;

  void _cycleWinSort() {
    setState(() {
      _winSort = switch (_winSort) {
        _WinSort.none => _WinSort.desc,
        _WinSort.desc => _WinSort.asc,
        _WinSort.asc => _WinSort.none,
      };
    });
  }

  @override
  void initState() {
    super.initState();
    _thresholdCtrl = TextEditingController(text: _minAmount.toStringAsFixed(0));
    _startCountdown();
    _load();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _countdownTimer = null;
    _thresholdCtrl.dispose();
    _sub?.cancel();
    _sub = null;
    super.dispose();
  }

  /// issue #1986：每秒递减倒计时，归零后回到 [_countdownStart] 循环；纯展示。
  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _tick = _tick <= 1 ? _countdownStart : _tick - 1);
    });
  }

  /// issue #1986：输入框文本解析为阈值。空 / 非法 → 0（不过滤）。
  void _onThresholdChanged(String raw) {
    final double parsed =
        double.tryParse(raw.replaceAll(RegExp(r'[^\d.]'), '')) ?? 0;
    setState(() => _minAmount = parsed);
  }

  /// issue #1986：打开监控规则弹窗，prefill 当前阈值 + 选中币种（备注）。
  Future<void> _openCreateMonitor() async {
    final WatchRule? rule = await WhaleWatchRuleSheet.show(
      context,
      prefillThreshold: _minAmount > 0 ? _minAmount : 500_000,
      prefillAlias: _symbolFilter.isEmpty ? null : _symbolFilter,
    );
    if (rule == null || !mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(
        content: Text(AppLocalizations.of(context).whaleLiveCoinPushDone),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  Future<void> _load() async {
    final repo = ref.read(whaleFeedRepositoryProvider);
    try {
      final List<WhaleEvent> history = await repo.listRecent(limit: 30);
      if (!mounted) return;
      // issue #1603: 历史接口理论上不应返回重复 id，但 mock / 后端
      // 重试链路存在重复风险；这里统一按首次出现保留，保障 ListView key 唯一。
      final Set<String> seen = <String>{};
      final List<WhaleEvent> deduped = <WhaleEvent>[
        for (final WhaleEvent e in history)
          if (seen.add(e.id)) e,
      ];
      setState(() {
        _items
          ..clear()
          ..addAll(deduped.map((WhaleEvent e) => _FeedItem(e, highlight: false)));
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
      // issue #1603: 推流可能与历史/重连重发产生相同 event.id，
      // 必须先按 id 去重再插入；否则同一 id 在 ListView 中出现两次会触发
      // RenderSliverMultiBoxAdaptor._debugVerifyChildOrder 断言失败以及
      // Duplicate Key 异常。
      _items.removeWhere((_FeedItem it) => it.event.id == event.id);
      _items.insert(0, _FeedItem(event, highlight: true));
    });
    Future<void>.delayed(const Duration(milliseconds: 700), () {
      if (!mounted) return;
      setState(() {
        // 按 id 定位目标 row，避免在 700ms 内被其它推流挤下时找错对象。
        for (final _FeedItem it in _items) {
          if (it.event.id == event.id) {
            it.highlight = false;
            break;
          }
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
        _buildFilterBar(c, l10n),
        _buildThresholdRow(c, l10n),
        _buildCountdownRow(c, l10n),
        _buildActionRow(c, l10n),
        if (_winSort == _WinSort.none)
          ..._buildGroupedFeed(visible, l10n, c)
        else
          ..._buildSortedFeed(visible, l10n, c),
        Padding(
          padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg, QzSpacing.md, QzSpacing.lg, QzSpacing.lg),
          child: _AddWatchButton(label: l10n.whaleAddWatchAddress),
        ),
      ],
    );
  }

  /// issue #1986：阈值自由文本输入框 `≥ $___`（mono）+ 「创建监控」按钮。
  /// 对齐设计稿 `m-screens-4.jsx:1596-1640`：左输入右按钮的 1fr/auto 栅格。
  Widget _buildThresholdRow(QzColorScheme c, AppLocalizations l10n) {
    return Container(
      width: double.infinity,
      color: c.bgElev,
      padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg, QzSpacing.sm, QzSpacing.lg, 10),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Container(
              height: 36,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: c.bgElev,
                border: Border.all(color: c.border),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: <Widget>[
                  Text(
                    l10n.whaleLiveThresholdPrefix,
                    style: TextStyle(color: c.textDim, fontSize: 12),
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    child: TextField(
                      controller: _thresholdCtrl,
                      onChanged: _onThresholdChanged,
                      keyboardType: TextInputType.number,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        fontFamily: QzFont.mono,
                        fontFamilyFallback: QzFont.monoFallback,
                      ),
                      decoration: const InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          SizedBox(
            height: 36,
            child: FilledButton(
              onPressed: _openCreateMonitor,
              style: FilledButton.styleFrom(
                backgroundColor: c.accent,
                foregroundColor: c.accentOn,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text(
                l10n.whaleLiveCreateMonitor,
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// issue #1986：右对齐「{n} 秒后更新」倒计时 + pulse 点，对齐设计稿
  /// `m-screens-4.jsx:1642-1665`。
  Widget _buildCountdownRow(QzColorScheme c, AppLocalizations l10n) {
    return Container(
      width: double.infinity,
      color: c.bgElev,
      padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg, 0, QzSpacing.lg, QzSpacing.md),
      alignment: Alignment.centerRight,
      child: Row(
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
            l10n.whaleLiveSecondsUntilUpdate(_tick),
            style: TextStyle(
              color: c.textMid,
              fontSize: 11,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ],
      ),
    );
  }

  /// issue #1983：胜率排序 toggle，循环 none → desc → asc → none，
  /// 对齐设计稿 `m-screens-4.jsx:595`。
  Widget _buildActionRow(QzColorScheme c, AppLocalizations l10n) {
    return Container(
      width: double.infinity,
      color: c.bgElev,
      padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg, 0, QzSpacing.lg, QzSpacing.sm),
      child: Row(
        children: <Widget>[
          _buildWinSortButton(c, l10n),
        ],
      ),
    );
  }

  /// issue #1983：胜率排序按钮，激活态高亮 + 方向图标，aria/tooltip 反映当前状态。
  Widget _buildWinSortButton(QzColorScheme c, AppLocalizations l10n) {
    final bool active = _winSort != _WinSort.none;
    final String hint = switch (_winSort) {
      _WinSort.none => l10n.whaleLiveWinSortNone,
      _WinSort.desc => l10n.whaleLiveWinSortDesc,
      _WinSort.asc => l10n.whaleLiveWinSortAsc,
    };
    final IconData icon = switch (_winSort) {
      _WinSort.none => Icons.swap_vert,
      _WinSort.desc => Icons.arrow_downward,
      _WinSort.asc => Icons.arrow_upward,
    };
    return Tooltip(
      message: hint,
      child: OutlinedButton.icon(
        onPressed: _cycleWinSort,
        icon: Icon(icon, size: 14, semanticLabel: hint),
        label: Text(
          l10n.whaleLiveWinSort,
          style: const TextStyle(fontSize: 12),
        ),
        style: OutlinedButton.styleFrom(
          foregroundColor: active ? c.accent : c.textMid,
          backgroundColor: active ? c.accentSoft : null,
          side: BorderSide(color: active ? c.accent : c.borderSoft),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          minimumSize: const Size(0, 30),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15),
          ),
        ),
      ),
    );
  }

  /// issue #1983：胜率排序激活时按 winRate 扁平展示（不再按时间分组），
  /// 对齐设计稿 `m-screens-4.jsx:705` 的排序模式。
  List<Widget> _buildSortedFeed(
      List<_FeedItem> visible, AppLocalizations l10n, QzColorScheme c) {
    if (visible.isEmpty) {
      return <Widget>[
        Padding(
          padding: const EdgeInsets.symmetric(vertical: QzSpacing.xl),
          child: QzEmptyState(title: l10n.whaleLiveFeedEmpty),
        ),
      ];
    }
    final List<_FeedItem> sorted = <_FeedItem>[...visible]..sort(
        (_FeedItem a, _FeedItem b) => _winSort == _WinSort.desc
            ? b.event.winRate.compareTo(a.event.winRate)
            : a.event.winRate.compareTo(b.event.winRate),
      );
    final String label = _winSort == _WinSort.desc
        ? l10n.whaleLiveWinSortDesc
        : l10n.whaleLiveWinSortAsc;
    final DateTime now = DateTime.now();
    return <Widget>[
      _GroupHeader(label: label, count: sorted.length),
      for (final _FeedItem item in sorted)
        QzWhaleRow(
          key: ValueKey<String>(item.event.id),
          event: item.event,
          highlight: item.highlight,
          now: now,
          displayTimestamp: now,
        ),
    ];
  }

  /// 单行 filter strip = 资产 chips · LIVE。阈值已迁出为独立输入行（issue #1986），
  /// 故此处仅保留币种 chips + LIVE pulse；资产 chips 横向滚动避免窄屏溢出。
  Widget _buildFilterBar(QzColorScheme c, AppLocalizations l10n) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(bottom: BorderSide(color: c.borderSoft, width: 1)),
      ),
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.sm,
        QzSpacing.lg,
        QzSpacing.sm,
      ),
      child: Row(
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
          const SizedBox(width: QzSpacing.sm),
          _LivePulse(label: l10n.whaleLiveLabel),
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
          child: QzEmptyState(title: l10n.whaleLiveFeedEmpty),
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

    // 派生 displayTimestamp：与分组语义对齐，解决 issue #1602
    // mock fixture timestamp 写死 2024-05 导致行内显示 `731 天前` 的穿帮。
    // - groupNow （最近 5 分钟）：now - i*30s （0~5min）
    // - group15  （15 分钟内）：  now - (5min + i*60s) （5~15min）
    // - group1h  （过去 1 小时）：now - (15min + i*5min) （15~60min）
    DateTime displayFor(String groupKey, int index) {
      switch (groupKey) {
        case 'now':
          return now.subtract(Duration(seconds: 30 * index));
        case '15m':
          return now.subtract(Duration(minutes: 5) + Duration(seconds: 60 * index));
        case '1h':
        default:
          return now.subtract(Duration(minutes: 15) + Duration(minutes: 5 * index));
      }
    }

    void appendGroup(String label, String groupKey, List<_FeedItem> rows) {
      if (rows.isEmpty) return;
      result.add(_GroupHeader(label: label, count: rows.length));
      for (int i = 0; i < rows.length; i++) {
        final _FeedItem item = rows[i];
        result.add(QzWhaleRow(
          key: ValueKey<String>(item.event.id),
          event: item.event,
          highlight: item.highlight,
          now: now,
          displayTimestamp: displayFor(groupKey, i),
        ));
      }
    }

    appendGroup(l10n.whaleGroupNow, 'now', groupNow);
    appendGroup(l10n.whaleGroup15m, '15m', group15);
    appendGroup(l10n.whaleGroup1h, '1h', group1h);
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
