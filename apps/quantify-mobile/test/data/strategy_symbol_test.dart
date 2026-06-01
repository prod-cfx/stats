import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/strategy_models.dart';

void main() {
  group('deriveStrategySymbol (#1884)', () {
    test('BTC/USDT 取 base 币种 BTC', () {
      expect(deriveStrategySymbol('BTC/USDT'), 'BTC');
    });

    test('dash 分隔取首币种（ARB-OP → ARB）', () {
      expect(deriveStrategySymbol('ARB-OP'), 'ARB');
      expect(deriveStrategySymbol('BTC-ETH'), 'BTC');
    });

    test('多币种占位回退到 ⇄', () {
      expect(deriveStrategySymbol('多币种'), '⇄');
    });

    test('空 pair 回退到 ?', () {
      expect(deriveStrategySymbol(''), '?');
      expect(deriveStrategySymbol('   '), '?');
    });

    test('单币种 ASCII pair 原样大写返回', () {
      expect(deriveStrategySymbol('usdt'), 'USDT');
    });

    test('前导分隔符 base 为空回退到 ⇄', () {
      expect(deriveStrategySymbol('/USDT'), '⇄');
      expect(deriveStrategySymbol('-OP'), '⇄');
    });

    test('base 含尾部空格走 trim 路径', () {
      expect(deriveStrategySymbol('ETH /USDT'), 'ETH');
    });

    test('长 base 原样返回（不截断）', () {
      expect(deriveStrategySymbol('1000PEPE/USDT'), '1000PEPE');
    });

    test('StrategyCard.symbol 复用派生逻辑', () {
      const StrategyCard card = StrategyCard(
        id: 's1',
        name: 'n',
        description: 'd',
        author: 'a',
        pnlPercent: 1,
        subscribers: 1,
        tags: <String>[],
        category: StrategyCategory.trend,
        pair: 'ETH/USDT',
      );
      expect(card.symbol, 'ETH');
    });

    test('空 pair 的 card.symbol 回退 ?（默认 pair=\'\'）', () {
      const StrategyCard card = StrategyCard(
        id: 's2',
        name: 'n',
        description: 'd',
        author: 'a',
        pnlPercent: 1,
        subscribers: 1,
        tags: <String>[],
        category: StrategyCategory.trend,
      );
      expect(card.symbol, '?');
    });
  });
}
