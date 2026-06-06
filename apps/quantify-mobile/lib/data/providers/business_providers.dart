import 'package:flutter_riverpod/flutter_riverpod.dart';
// `FutureProviderFamily` 在 Riverpod 3.x 未由 flutter_riverpod 公开导出，
// family provider 的显式类型注解需直连 misc。
import 'package:riverpod/misc.dart' show FutureProviderFamily;

import '../../theme/theme_notifier.dart' show sharedPreferencesProvider;
import '../../domain/models/live_strategy_models.dart';
import '../mock/fixtures/live_strategies.dart' show mockLivePositions;
import '../mock/fixtures/whale_extras.dart';
import '../models/whale_extra_models.dart';
import '../storage/market_favorites_persistence.dart';
import '../storage/strategy_favorites_persistence.dart';
import '../storage/strategy_search_history_persistence.dart';
import '../storage/strategy_subscription_persistence.dart';
import 'repository_providers.dart';

final Provider<StrategySubscriptionPersistence>
strategySubscriptionPersistenceProvider =
    Provider<StrategySubscriptionPersistence>((Ref ref) {
      return StrategySubscriptionPersistence(
        ref.watch(sharedPreferencesProvider),
      );
    });

/// 已订阅策略 id 集合。
///
/// `build()` 同步从 SharedPreferences 读取（与 ThemeNotifier 同模式：上层
/// `main()` 已 override `sharedPreferencesProvider` 为 resolved 实例）。
/// `toggle(id)` 会乐观更新内存状态，再写盘；写盘失败回滚到先前快照避免
/// 内存与磁盘漂移。
class StrategySubscriptionsNotifier extends Notifier<Set<String>> {
  @override
  Set<String> build() {
    return ref.watch(strategySubscriptionPersistenceProvider).read();
  }

  bool isSubscribed(String id) => state.contains(id);

  Future<void> toggle(String id) async {
    final Set<String> previous = state;
    final Set<String> next = <String>{...previous};
    if (!next.add(id)) next.remove(id);
    state = next;
    try {
      await ref.read(strategySubscriptionPersistenceProvider).write(next);
    } catch (_) {
      state = previous;
      rethrow;
    }
  }
}

final NotifierProvider<StrategySubscriptionsNotifier, Set<String>>
strategySubscriptionsProvider =
    NotifierProvider<StrategySubscriptionsNotifier, Set<String>>(
      StrategySubscriptionsNotifier.new,
    );

final Provider<StrategyFavoritesPersistence>
strategyFavoritesPersistenceProvider = Provider<StrategyFavoritesPersistence>((
  Ref ref,
) {
  return StrategyFavoritesPersistence(ref.watch(sharedPreferencesProvider));
});

/// 已收藏（星标）策略 id 集合（#1565）。
///
/// 与 [StrategySubscriptionsNotifier] 同 toggle/写盘/回滚模式：乐观更新内存，
/// 写盘失败回滚保证内存与磁盘一致。
class StrategyFavoritesNotifier extends Notifier<Set<String>> {
  @override
  Set<String> build() {
    return ref.watch(strategyFavoritesPersistenceProvider).read();
  }

  bool isFavorite(String id) => state.contains(id);

  Future<void> toggle(String id) async {
    final Set<String> previous = state;
    final Set<String> next = <String>{...previous};
    if (!next.add(id)) next.remove(id);
    state = next;
    try {
      await ref.read(strategyFavoritesPersistenceProvider).write(next);
    } catch (_) {
      state = previous;
      rethrow;
    }
  }
}

final NotifierProvider<StrategyFavoritesNotifier, Set<String>>
strategyFavoritesProvider =
    NotifierProvider<StrategyFavoritesNotifier, Set<String>>(
      StrategyFavoritesNotifier.new,
    );

final Provider<StrategySearchHistoryPersistence>
strategySearchHistoryPersistenceProvider =
    Provider<StrategySearchHistoryPersistence>((Ref ref) {
      return StrategySearchHistoryPersistence(
        ref.watch(sharedPreferencesProvider),
      );
    });

/// 策略广场搜索历史（最近在前，去重置顶，cap=[StrategySearchHistoryPersistence.kMax]）。
///
/// 与 [StrategyFavoritesNotifier] 同乐观写盘模式：内存先更新，写盘失败回滚。
class StrategySearchHistoryNotifier extends Notifier<List<String>> {
  @override
  List<String> build() {
    return ref.watch(strategySearchHistoryPersistenceProvider).read();
  }

  /// 记录一次搜索词：去重后置顶，截断到上限。空白串忽略。
  Future<void> push(String term) async {
    final String t = term.trim();
    if (t.isEmpty) return;
    final List<String> previous = state;
    final List<String> next = <String>[
      t,
      ...previous.where((String x) => x != t),
    ].take(StrategySearchHistoryPersistence.kMax).toList(growable: false);
    state = next;
    try {
      await ref.read(strategySearchHistoryPersistenceProvider).write(next);
    } catch (_) {
      state = previous;
      rethrow;
    }
  }

  Future<void> clear() async {
    final List<String> previous = state;
    if (previous.isEmpty) return;
    state = const <String>[];
    try {
      await ref
          .read(strategySearchHistoryPersistenceProvider)
          .write(const <String>[]);
    } catch (_) {
      state = previous;
      rethrow;
    }
  }
}

final NotifierProvider<StrategySearchHistoryNotifier, List<String>>
strategySearchHistoryProvider =
    NotifierProvider<StrategySearchHistoryNotifier, List<String>>(
      StrategySearchHistoryNotifier.new,
    );

final Provider<MarketFavoritesPersistence> marketFavoritesPersistenceProvider =
    Provider<MarketFavoritesPersistence>((Ref ref) {
      return MarketFavoritesPersistence(ref.watch(sharedPreferencesProvider));
    });

/// 已收藏（自选）行情 symbol 集合（#1755）。
///
/// 与 [StrategyFavoritesNotifier] 同 toggle/写盘/回滚模式：乐观更新内存，
/// 写盘失败回滚保证内存与磁盘一致。详情页与行情列表自选 tab 共享此 provider，
/// 使收藏状态在两个入口间保持一致。
class MarketFavoritesNotifier extends Notifier<Set<String>> {
  /// 首次启动（键从未写盘）时的默认自选集合，对齐行情列表自选 tab 的
  /// mock 种子。用户一旦增删即以持久化为准；显式清空后不再被种子填充。
  static const Set<String> kDefaultSymbols = <String>{
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
    'BNBUSDT',
    'XRPUSDT',
  };

  @override
  Set<String> build() {
    // null = 键从未写盘 → 填种子；空集 = 用户已清空 → 保持空，不复活。
    final Set<String>? stored =
        ref.watch(marketFavoritesPersistenceProvider).read();
    return stored ?? <String>{...kDefaultSymbols};
  }

  bool isFavorite(String symbol) => state.contains(symbol);

  /// 写盘进行中标志：串行化 toggle，避免快速双击时回滚快照交错丢值。
  bool _writing = false;

  Future<void> toggle(String symbol) async {
    if (_writing) return;
    final Set<String> previous = state;
    final Set<String> next = <String>{...previous};
    if (!next.add(symbol)) next.remove(symbol);
    state = next;
    _writing = true;
    try {
      await ref.read(marketFavoritesPersistenceProvider).write(next);
    } catch (_) {
      state = previous;
      rethrow;
    } finally {
      _writing = false;
    }
  }
}

final NotifierProvider<MarketFavoritesNotifier, Set<String>>
marketFavoritesProvider =
    NotifierProvider<MarketFavoritesNotifier, Set<String>>(
      MarketFavoritesNotifier.new,
    );

/// 实盘策略有状态 store（#1773）。
///
/// 单一可变真源：初始 seed 自 repository，暂停/恢复/删除等操作在客户端就地
/// 转换状态（mock-first）。列表/摘要/详情/持仓 provider 均从此派生，保证一次
/// 操作后全端一致刷新。真实实例接口（#1682/#1683）接通后此 store 退役。
class LiveStrategyStore extends AsyncNotifier<List<LiveStrategy>> {
  @override
  Future<List<LiveStrategy>> build() async {
    return ref.watch(liveStrategyRepositoryProvider).listStrategies();
  }

  /// 暂停：running / warning -> paused，附「等待恢复」状态注。
  void pause(String id) {
    _mutate(
      id,
      (LiveStrategy s) => s.copyWith(
        status: LiveStrategyStatus.paused,
        statusNote: '已暂停 · 等待恢复',
      ),
    );
  }

  /// 恢复：任意非 running -> running，清状态注。
  void resume(String id) {
    _mutate(
      id,
      (LiveStrategy s) => s.copyWith(
        status: LiveStrategyStatus.running,
        statusNote: null,
      ),
    );
  }

  /// 软删：-> stopped，保留 30 天。
  void softDelete(String id) {
    _mutate(
      id,
      (LiveStrategy s) => s.copyWith(
        status: LiveStrategyStatus.stopped,
        statusNote: '已停止 · 28 天后永久删除',
      ),
    );
  }

  /// 永久删除：从列表移除。
  void permanentDelete(String id) {
    final List<LiveStrategy>? current = state.value;
    if (current == null) return;
    state = AsyncData<List<LiveStrategy>>(
      current.where((LiveStrategy s) => s.id != id).toList(growable: false),
    );
  }

  void _mutate(String id, LiveStrategy Function(LiveStrategy) transform) {
    final List<LiveStrategy>? current = state.value;
    if (current == null) return;
    state = AsyncData<List<LiveStrategy>>(
      current
          .map((LiveStrategy s) => s.id == id ? transform(s) : s)
          .toList(growable: false),
    );
  }
}

/// 实盘策略 store provider（#1773）。
final AsyncNotifierProvider<LiveStrategyStore, List<LiveStrategy>>
liveStrategyStoreProvider =
    AsyncNotifierProvider<LiveStrategyStore, List<LiveStrategy>>(
      LiveStrategyStore.new,
    );

/// 实盘策略列表（#1752）。列表页 watch；含 stopped。派生自 store。
final FutureProvider<List<LiveStrategy>> liveStrategiesProvider =
    FutureProvider<List<LiveStrategy>>((Ref ref) async {
      return ref.watch(liveStrategyStoreProvider.future);
    });

/// 实盘策略聚合摘要（#1752）。列表页顶部卡 watch。从 store 当前列表重算
/// （排除 stopped），口径与设计稿 `active` 统计一致。
final FutureProvider<LiveStrategySummary> liveStrategySummaryProvider =
    FutureProvider<LiveStrategySummary>((Ref ref) async {
      final List<LiveStrategy> all =
          await ref.watch(liveStrategyStoreProvider.future);
      final List<LiveStrategy> active =
          all.where((LiveStrategy s) => s.isActive).toList();
      double cap = 0;
      double today = 0;
      double total = 0;
      int running = 0;
      int warning = 0;
      int paused = 0;
      double winRateWeighted = 0;
      int tradesTotal = 0;
      for (final LiveStrategy s in active) {
        cap += s.capital;
        today += s.todayPnl;
        total += s.totalPnl;
        winRateWeighted += s.winRate * s.trades;
        tradesTotal += s.trades;
        switch (s.status) {
          case LiveStrategyStatus.running:
            running++;
          case LiveStrategyStatus.warning:
            warning++;
          case LiveStrategyStatus.paused:
            paused++;
          case LiveStrategyStatus.stopped:
            break;
        }
      }
      final int stopped = all
          .where((LiveStrategy s) => s.status == LiveStrategyStatus.stopped)
          .length;
      return LiveStrategySummary(
        totalAssets: cap + total,
        totalCapital: cap,
        todayPnl: today,
        totalPnl: total,
        runningCount: running,
        warningCount: warning,
        pausedCount: paused,
        stoppedCount: stopped,
        winRate: tradesTotal == 0 ? 0 : winRateWeighted / tradesTotal,
      );
    });

/// 单个实盘策略详情（#1752）。派生自 store；未命中抛错（详情页落 error 态）。
final FutureProviderFamily<LiveStrategy, String> liveStrategyDetailProvider =
    FutureProvider.family<LiveStrategy, String>((Ref ref, String id) async {
      final List<LiveStrategy> all =
          await ref.watch(liveStrategyStoreProvider.future);
      return all.firstWhere((LiveStrategy s) => s.id == id);
    });

// position/trades/params 三个 per-tab provider：契约 AccountAiQuantStrategyDetailResponseDto
// 的 positionOverview/latestOrders/paramValues 均为无内层 schema 的 object/array<object>，
// 在 typed array-element schema 落地前，repo 内部短路到 mock（不再发 HTTP），保持 mock 兜底。

/// 单个实盘策略持仓（#1752）。null 表示无持仓（已暂停/停止）。
/// 从 store 取最新 status 判断 mayHavePosition，确保暂停后持仓即时消失。
final FutureProviderFamily<LiveStrategyPosition?, String>
liveStrategyPositionProvider =
    FutureProvider.family<LiveStrategyPosition?, String>((
      Ref ref,
      String id,
    ) async {
      final List<LiveStrategy> all =
          await ref.watch(liveStrategyStoreProvider.future);
      final LiveStrategy s = all.firstWhere((LiveStrategy x) => x.id == id);
      if (!s.mayHavePosition) return null;
      return mockLivePositions[id];
    });

/// 单个实盘策略历史成交（#1752）。
final FutureProviderFamily<List<LiveStrategyTrade>, String>
liveStrategyTradesProvider =
    FutureProvider.family<List<LiveStrategyTrade>, String>((
      Ref ref,
      String id,
    ) async {
      return ref.watch(liveStrategyRepositoryProvider).listTrades(id);
    });

/// 单个实盘策略参数（#1752）。
final FutureProviderFamily<List<LiveStrategyParam>, String>
liveStrategyParamsProvider =
    FutureProvider.family<List<LiveStrategyParam>, String>((
      Ref ref,
      String id,
    ) async {
      return ref.watch(liveStrategyRepositoryProvider).listParams(id);
    });

/// 巨鲸通知中心单一数据源（issue #1769）。
///
/// 顶部铃铛 panel 与监控 Tab 内「通知中心」子 Tab 共享同一份列表与
/// 已读状态，避免两套独立 state 漂移。mock 阶段种子来自
/// [mockWhaleNotifications]，真实推送（#1683）接入后替换 seed 来源即可。
class WhaleNotificationsNotifier
    extends Notifier<List<WhaleNotification>> {
  @override
  List<WhaleNotification> build() =>
      List<WhaleNotification>.of(mockWhaleNotifications);

  int get unreadCount =>
      state.where((WhaleNotification n) => n.unread).length;

  /// 标记单条已读（点击通知行时调用）。
  void markRead(String id) {
    state = <WhaleNotification>[
      for (final WhaleNotification n in state)
        if (n.id == id) n.copyWith(unread: false) else n,
    ];
  }

  /// 全部标记已读。
  void markAllRead() {
    state = <WhaleNotification>[
      for (final WhaleNotification n in state) n.copyWith(unread: false),
    ];
  }

  /// 整表替换（铃铛 panel 关闭后回写其内部副本）。
  void replaceAll(List<WhaleNotification> next) {
    state = List<WhaleNotification>.of(next);
  }
}

/// 通知中心共享 provider（issue #1769）。
final NotifierProvider<WhaleNotificationsNotifier, List<WhaleNotification>>
    whaleNotificationsProvider =
    NotifierProvider<WhaleNotificationsNotifier, List<WhaleNotification>>(
  WhaleNotificationsNotifier.new,
);

/// 未读通知计数派生 provider（#2192）。
///
/// 各 View（顶部铃铛角标 / 监控 Tab）原先在 `build()` 内 `where(unread).length`
/// 内联聚合；上移为派生 provider，View 仅 `ref.watch`，计数随列表响应式更新。
final Provider<int> whaleUnreadCountProvider = Provider<int>((Ref ref) {
  return ref
      .watch(whaleNotificationsProvider)
      .where((WhaleNotification n) => n.unread)
      .length;
});
