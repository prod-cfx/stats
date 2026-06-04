import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/error_router.dart';
import '../../../core/providers/notifier_lifecycle.dart';
import '../../../data/models/whale_models.dart';
import '../../../data/providers.dart';
import 'whale_live_tab_state.dart';

/// 实时 tab 控制器（issue #2183 三件套迁移）。
///
/// `build()` 内启动倒计时 + 发起历史加载并订阅推流（替换原 `initState`）；
/// `ref.onDispose` 取消 `_sub` 与 `_countdownTimer`（替换原 `dispose`）。异步
/// 回调前用 [NotifierLifecycle] 的 `mounted` 守卫，异常经 `ErrorRouter.normalize`
/// 落 `state.error`。
class WhaleLiveTabController extends Notifier<WhaleLiveTabState> {
  final NotifierLifecycle _life = NotifierLifecycle();
  StreamSubscription<WhaleEvent>? _sub;
  Timer? _countdownTimer;

  bool get mounted => _life.mounted;

  @override
  WhaleLiveTabState build() {
    _life.attach(ref);
    ref.onDispose(() {
      _countdownTimer?.cancel();
      _countdownTimer = null;
      _sub?.cancel();
      _sub = null;
    });
    _startCountdown();
    _load();
    return const WhaleLiveTabState();
  }

  /// issue #1986：每秒递减倒计时，归零回到起始值循环；纯展示。
  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final int next = state.tick <= 1
          ? WhaleLiveTabState.countdownStart
          : state.tick - 1;
      state = state.copyWith(tick: next);
    });
  }

  Future<void> _load() async {
    final repo = ref.read(whaleFeedRepositoryProvider);
    try {
      final List<WhaleEvent> history = await repo.listRecent(limit: 30);
      if (!mounted) return;
      // issue #1603：历史接口理论不应返回重复 id，但 mock/重试链路存在重复风险；
      // 按首次出现保留，保障 ListView key 唯一。
      final Set<String> seen = <String>{};
      final List<WhaleLiveFeedItem> deduped = <WhaleLiveFeedItem>[
        for (final WhaleEvent e in history)
          if (seen.add(e.id)) WhaleLiveFeedItem(e, highlight: false),
      ];
      state = state.copyWith(items: deduped, loading: false, error: null);
      _sub = repo.watchFeed().listen(_onPush);
    } catch (error) {
      if (!mounted) return;
      state = state.copyWith(
        loading: false,
        error: ErrorRouter.normalize(error),
      );
    }
  }

  void _onPush(WhaleEvent event) {
    if (!_passesFilter(event, state.symbolFilter)) return;
    if (!mounted) return;
    // issue #1603：按 id 去重再插入，避免重复 key 触发断言/异常。
    final List<WhaleLiveFeedItem> next = <WhaleLiveFeedItem>[
      WhaleLiveFeedItem(event, highlight: true),
      for (final WhaleLiveFeedItem it in state.items)
        if (it.event.id != event.id) it,
    ];
    state = state.copyWith(items: next);
    Future<void>.delayed(const Duration(milliseconds: 700), () {
      if (!mounted) return;
      // 按 id 定位目标条目复位高亮（700ms 内可能被新推流挤位）。
      state = state.copyWith(
        items: <WhaleLiveFeedItem>[
          for (final WhaleLiveFeedItem it in state.items)
            if (it.event.id == event.id) it.copyWith(highlight: false) else it,
        ],
      );
    });
  }

  static bool _passesFilter(WhaleEvent e, String filter) {
    if (filter.isEmpty) return true;
    return e.symbol.startsWith(filter);
  }

  void setSymbolFilter(String filter) {
    state = state.copyWith(symbolFilter: filter);
  }

  /// issue #1983：胜率排序循环 none → desc → asc → none。
  void cycleWinSort() {
    final WhaleLiveWinSort next = switch (state.winSort) {
      WhaleLiveWinSort.none => WhaleLiveWinSort.desc,
      WhaleLiveWinSort.desc => WhaleLiveWinSort.asc,
      WhaleLiveWinSort.asc => WhaleLiveWinSort.none,
    };
    state = state.copyWith(winSort: next);
  }
}

final whaleLiveTabControllerProvider =
    NotifierProvider.autoDispose<WhaleLiveTabController, WhaleLiveTabState>(
      WhaleLiveTabController.new,
    );
