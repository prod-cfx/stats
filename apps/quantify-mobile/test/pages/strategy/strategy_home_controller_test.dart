import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/strategy_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/strategy_repository.dart';
import 'package:quantify_mobile/pages/strategy/strategy_home_controller.dart';
import 'package:quantify_mobile/pages/strategy/strategy_home_state.dart';
import 'package:quantify_mobile/pages/strategy/widgets/strategy_sort_sheet.dart'
    show StrategySortKey;

/// issue #2185 验收：strategy_home controller 的分页 + 筛选/排序 + toast 流转。
/// 覆盖 category/sort 变更触发 reset+首页加载、loadMore 翻页与 hasMore 终止、
/// 重复 loadMore 短路、toast 设置后超时自动清空。
void main() {
  StrategyMarketItem item(String id, {required int users}) {
    return StrategyMarketItem(
      card: StrategyCard(
        id: id,
        name: 'S-$id',
        description: '',
        author: 'a',
        pnlPercent: 0,
        subscribers: 0,
        tags: const <String>[],
        category: StrategyCategory.all,
      ),
      sparkline: const <double>[],
      stats: StrategyMarketStats(
        cagr: 0,
        sharpe: 0,
        maxDrawdown: 0,
        winRate: 0,
        users: users,
      ),
    );
  }

  group('StrategyHomeController', () {
    test('reload：重置回第 1 页 + 按 users 降序加载首页 + 关闭 loading', () async {
      final ProviderContainer c = makeContainer(
        _FakeRepo(<int, StrategyMarketPage>{
          1: _page(<StrategyMarketItem>[
            item('a', users: 10),
            item('b', users: 30),
            item('c', users: 20),
          ], hasMore: true),
        }),
      );
      await ctrl(c).reload();
      final StrategyHomeState s = read(c);
      expect(s.loading, isFalse);
      expect(s.page, 1);
      expect(s.hasMore, isTrue);
      // 默认 sort=hot 按 users 降序。
      expect(s.items.map((StrategyMarketItem e) => e.card.id).toList(),
          <String>['b', 'c', 'a']);
    });

    test('setCategory：变更触发 reset + 首页加载（category 落到请求）', () async {
      final _FakeRepo repo = _FakeRepo(<int, StrategyMarketPage>{
        1: _page(<StrategyMarketItem>[item('x', users: 5)], hasMore: false),
      });
      final ProviderContainer c = makeContainer(repo);
      ctrl(c).setCategory(StrategyCategory.trend);
      await pumpEventQueue();
      expect(read(c).category, StrategyCategory.trend);
      expect(repo.lastCategory, StrategyCategory.trend);
      expect(read(c).page, 1);
      expect(read(c).items.single.card.id, 'x');
    });

    test('setSort：内存重排现有 items，不重拉接口', () async {
      final _FakeRepo repo = _FakeRepo(<int, StrategyMarketPage>{
        1: _page(<StrategyMarketItem>[
          item('a', users: 10),
          item('b', users: 30),
        ], hasMore: false),
      });
      final ProviderContainer c = makeContainer(repo);
      await ctrl(c).reload();
      final int callsBefore = repo.listCalls;
      // 切到 cagr（全 0 相等，稳定）后再切回 hot 验证不触发新请求。
      ctrl(c).setSort(StrategySortKey.cagr);
      expect(repo.listCalls, callsBefore, reason: 'setSort 不应重拉');
      expect(read(c).sort, StrategySortKey.cagr);
    });

    test('loadMore：翻页累加 items + 推进 page', () async {
      final _FakeRepo repo = _FakeRepo(<int, StrategyMarketPage>{
        1: _page(<StrategyMarketItem>[item('a', users: 10)], hasMore: true),
        2: _page(<StrategyMarketItem>[item('b', users: 20)], hasMore: false),
      });
      final ProviderContainer c = makeContainer(repo);
      await ctrl(c).reload();
      await ctrl(c).loadMore();
      final StrategyHomeState s = read(c);
      expect(s.page, 2);
      expect(s.hasMore, isFalse);
      expect(s.items.length, 2);
    });

    test('loadMore：hasMore=false 时短路，不再请求', () async {
      final _FakeRepo repo = _FakeRepo(<int, StrategyMarketPage>{
        1: _page(<StrategyMarketItem>[item('a', users: 10)], hasMore: false),
      });
      final ProviderContainer c = makeContainer(repo);
      await ctrl(c).reload();
      final int callsBefore = repo.listCalls;
      await ctrl(c).loadMore();
      expect(repo.listCalls, callsBefore, reason: 'hasMore=false 应短路');
    });

    test('loadMore：进行中重复调用短路（loadingMore 守卫）', () async {
      final _FakeRepo repo = _FakeRepo(<int, StrategyMarketPage>{
        1: _page(<StrategyMarketItem>[item('a', users: 10)], hasMore: true),
        2: _page(<StrategyMarketItem>[item('b', users: 20)], hasMore: true),
      }, delay: const Duration(milliseconds: 50));
      final ProviderContainer c = makeContainer(repo);
      await ctrl(c).reload();
      final int callsBefore = repo.listCalls;
      // 不 await 第一次，立刻发第二次——应被 loadingMore 守卫短路。
      final Future<void> first = ctrl(c).loadMore();
      await ctrl(c).loadMore();
      expect(repo.listCalls, callsBefore + 1,
          reason: '并发 loadMore 第二次应短路');
      await first;
    });

    test('toast：fireToastAndNav 设置文案，超时后自动清空', () async {
      final ProviderContainer c = makeContainer(
        _FakeRepo(<int, StrategyMarketPage>{
          1: _page(const <StrategyMarketItem>[], hasMore: false),
        }),
      );
      ctrl(c).fireToastAndNav(message: '已启动', route: '/me/live');
      expect(read(c).toast, '已启动');
      // 等待超过 toast 时长（2400ms），文案应被清空。
      await Future<void>.delayed(
        StrategyHomeController.kToastDuration + const Duration(milliseconds: 50),
      );
      expect(read(c).toast, isNull);
    });
  });
}

StrategyMarketPage _page(List<StrategyMarketItem> items, {required bool hasMore}) {
  return StrategyMarketPage(
    items: items,
    hasMore: hasMore,
    page: 1,
    pageSize: 10,
  );
}

ProviderContainer makeContainer(StrategyRepository repo) {
  final ProviderContainer c = ProviderContainer(
    overrides: <Override>[strategyRepositoryProvider.overrideWithValue(repo)],
  );
  addTearDown(c.dispose);
  // 保持订阅，避免 autoDispose provider 在两次 read 之间被销毁、state 丢失。
  c.listen(strategyHomeControllerProvider, (_, _) {});
  return c;
}

StrategyHomeController ctrl(ProviderContainer c) =>
    c.read(strategyHomeControllerProvider.notifier);

StrategyHomeState read(ProviderContainer c) =>
    c.read(strategyHomeControllerProvider);

/// 按页码返回固定结果的假 repo，仅实现 controller 用到的 listMarket。
class _FakeRepo implements StrategyRepository {
  _FakeRepo(this._pages, {this.delay = Duration.zero});

  final Map<int, StrategyMarketPage> _pages;
  final Duration delay;

  int listCalls = 0;
  StrategyCategory? lastCategory;

  @override
  Future<StrategyMarketPage> listMarket({
    int page = 1,
    int pageSize = 10,
    String? query,
    StrategyCategory? category,
  }) async {
    listCalls++;
    lastCategory = category;
    if (delay > Duration.zero) {
      await Future<void>.delayed(delay);
    }
    return _pages[page] ??
        const StrategyMarketPage(
          items: <StrategyMarketItem>[],
          hasMore: false,
          page: 1,
          pageSize: 10,
        );
  }

  @override
  Future<StrategyMarketItem> getFeaturedHero() => throw UnimplementedError();

  @override
  Future<StrategyCard> getDetail(String id) => throw UnimplementedError();

  @override
  Future<List<StrategyCard>> listFeatured() => throw UnimplementedError();

  @override
  Future<List<StrategyCard>> listMine() => throw UnimplementedError();

  @override
  Future<StrategyDetail> getStrategyDetail(String id) =>
      throw UnimplementedError();

  @override
  Future<List<StrategySignal>> listStrategySignals(String id, {int limit = 20}) =>
      throw UnimplementedError();

  @override
  Future<List<double>> getEquityCurve(String id, EquityTimeframe timeframe) =>
      throw UnimplementedError();
}
