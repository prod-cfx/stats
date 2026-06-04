import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/strategy_models.dart';
import 'package:quantify_mobile/pages/strategy/strategy_home_state.dart';

/// #2192：`strategyShowFeatured` / `strategyListItems` / `strategyResultCount`
/// 纯派生（从 `StrategyHomePage.build` 上移）单测。
StrategyMarketItem _item(String id, {StrategyCategory cat = StrategyCategory.trend}) {
  return StrategyMarketItem(
    card: StrategyCard(
      id: id,
      name: id,
      description: '',
      author: '',
      pnlPercent: 0,
      subscribers: 0,
      tags: const <String>[],
      category: cat,
    ),
    sparkline: const <double>[],
    stats: const StrategyMarketStats(
      cagr: 0,
      sharpe: 0,
      maxDrawdown: 0,
      winRate: 0,
      users: 0,
    ),
  );
}

void main() {
  final List<StrategyMarketItem> items = <StrategyMarketItem>[
    _item('a'),
    _item('b'),
    _item('c'),
  ];

  group('strategyShowFeatured', () {
    test('全部分类 + 无搜索 + 非收藏 + 有 featured → true', () {
      final s = StrategyHomeState(items: items, featured: _item('a'));
      expect(strategyShowFeatured(s), isTrue);
    });

    test('收藏视图 / 有搜索 / 非全部分类 → false', () {
      expect(
        strategyShowFeatured(
          StrategyHomeState(items: items, featured: _item('a'), favOnly: true),
        ),
        isFalse,
      );
      expect(
        strategyShowFeatured(
          StrategyHomeState(items: items, featured: _item('a'), query: 'btc'),
        ),
        isFalse,
      );
      expect(
        strategyShowFeatured(
          StrategyHomeState(
            items: items,
            featured: _item('a'),
            category: StrategyCategory.grid,
          ),
        ),
        isFalse,
      );
    });

    test('无 featured → false', () {
      expect(strategyShowFeatured(StrategyHomeState(items: items)), isFalse);
    });
  });

  group('strategyListItems', () {
    test('featured 显示时剔除同 id', () {
      final s = StrategyHomeState(items: items, featured: _item('a'));
      final out = strategyListItems(s, const <String>{});
      expect(out.map((StrategyMarketItem it) => it.card.id), <String>['b', 'c']);
    });

    test('收藏视图仅留 favorites 内策略', () {
      final s = StrategyHomeState(items: items, favOnly: true);
      final out = strategyListItems(s, <String>{'b'});
      expect(out.single.card.id, 'b');
    });
  });

  group('strategyResultCount', () {
    test('非收藏视图 = 全量条数', () {
      final s = StrategyHomeState(items: items);
      expect(strategyResultCount(s, const <String>{}), 3);
    });

    test('收藏视图 = 过滤后条数', () {
      final s = StrategyHomeState(items: items, favOnly: true);
      expect(strategyResultCount(s, <String>{'a', 'c'}), 2);
    });
  });
}
