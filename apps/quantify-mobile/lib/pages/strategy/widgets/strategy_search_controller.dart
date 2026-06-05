import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/strategy_models.dart';
import '../../../data/providers.dart';
import '../../../data/repositories/strategy_repository.dart';
import 'strategy_search_state.dart';

/// 策略广场联合搜索控制器（issue #2228）。
///
/// 取数从 `_StrategySearchOverlayState`（View）下沉至此：`build()` 首屏 `loadGuess`；
/// [search] 承接输入触发的网络段（策略 / 作者命中），seq 竞态守卫迁入此处。标签段为
/// 纯本地 `AppLocalizations` 匹配，由 widget 算好后作为 [search] 的 `tagHits` 传入。
class StrategySearchController extends Notifier<StrategySearchState> {
  bool _disposed = false;
  int _reqSeq = 0;

  @override
  StrategySearchState build() {
    ref.onDispose(() => _disposed = true);
    Future<void>.microtask(loadGuess);
    return const StrategySearchState();
  }

  /// 「猜你想跟」：拉一页后本地按在跟人数降序取前 3（与设计稿一致）。
  Future<void> loadGuess() async {
    final StrategyRepository repo = ref.read(strategyRepositoryProvider);
    final StrategyMarketPage page = await repo.listMarket(pageSize: 50);
    if (_disposed) return;
    final List<StrategyMarketItem> sorted = <StrategyMarketItem>[...page.items]
      ..sort(
        (StrategyMarketItem a, StrategyMarketItem b) =>
            b.stats.users.compareTo(a.stats.users),
      );
    state = state.copyWith(guess: sorted.take(3).toList(growable: false));
  }

  /// 输入触发的联合搜索。空查询清空命中；否则按 [query] 拉取并聚合作者命中。
  /// [tagHits] 为 widget 预先用 `AppLocalizations` 算好的标签段（本地匹配）。
  Future<void> search(String query, List<StrategyCategory> tagHits) async {
    final String q = query.trim();
    if (q.isEmpty) {
      ++_reqSeq; // 作废在途请求
      state = state.copyWith(
        loading: false,
        stratHits: <StrategyMarketItem>[],
        authorHits: <AuthorHit>[],
        tagHits: <StrategyCategory>[],
      );
      return;
    }
    final int seq = ++_reqSeq;
    state = state.copyWith(loading: true, tagHits: tagHits);

    final StrategyRepository repo = ref.read(strategyRepositoryProvider);
    final StrategyMarketPage page = await repo.listMarket(
      query: q,
      pageSize: 50,
    );
    if (_disposed || seq != _reqSeq) return;

    // 作者聚合：count 计数 + verified 取该作者任一策略的认证态。
    final String lower = q.toLowerCase();
    final Map<String, int> authorCount = <String, int>{};
    final Map<String, bool> authorVerified = <String, bool>{};
    for (final StrategyMarketItem it in page.items) {
      final String a = it.card.author;
      authorCount[a] = (authorCount[a] ?? 0) + 1;
      authorVerified[a] = (authorVerified[a] ?? false) || it.card.verified;
    }
    final List<AuthorHit> authors = authorCount.entries
        .where(
          (MapEntry<String, int> e) => e.key.toLowerCase().contains(lower),
        )
        .map(
          (MapEntry<String, int> e) => AuthorHit(
            name: e.key,
            count: e.value,
            verified: authorVerified[e.key] ?? false,
          ),
        )
        .toList(growable: false);

    state = state.copyWith(
      loading: false,
      tagHits: tagHits,
      authorHits: authors,
      stratHits: page.items,
    );
  }
}

final strategySearchControllerProvider =
    NotifierProvider.autoDispose<StrategySearchController, StrategySearchState>(
      StrategySearchController.new,
    );
