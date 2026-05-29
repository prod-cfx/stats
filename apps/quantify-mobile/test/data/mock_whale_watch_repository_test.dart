import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_whale_watch_repository.dart';
import 'package:quantify_mobile/data/models/whale_watch_models.dart';

void main() {
  group('MockWhaleWatchRepository', () {
    const MockWhaleWatchRepository repo = MockWhaleWatchRepository();

    test('listRules 返回非空种子，且每条字段完整', () async {
      final List<WatchRule> rules = await repo.listRules();
      expect(rules, isNotEmpty);
      for (final WatchRule r in rules) {
        expect(r.id, isNotEmpty);
        expect(r.address, isNotEmpty);
        expect(r.thresholdUsd, greaterThan(0));
        expect(r.channels, isNotEmpty);
      }
    });

    test('listRules 返回副本，外部修改不污染下次结果', () async {
      final List<WatchRule> a = await repo.listRules();
      a.clear();
      final List<WatchRule> b = await repo.listRules();
      expect(b, isNotEmpty);
    });

    test('空 query 返回空列表', () async {
      expect(await repo.search(''), isEmpty);
      expect(await repo.search('   '), isEmpty);
    });

    test('搜索命中地址类', () async {
      final List<WhaleSearchResult> res = await repo.search('0xa83');
      expect(res, isNotEmpty);
      expect(
        res.any((WhaleSearchResult r) =>
            r.kind == WhaleSearchResultKind.address && r.address != null),
        isTrue,
      );
    });

    test('搜索命中标签类', () async {
      final List<WhaleSearchResult> res = await repo.search('聪明钱');
      expect(
        res.any((WhaleSearchResult r) => r.kind == WhaleSearchResultKind.label),
        isTrue,
      );
    });

    test('搜索命中资产类', () async {
      final List<WhaleSearchResult> res = await repo.search('ETH');
      expect(
        res.any((WhaleSearchResult r) => r.kind == WhaleSearchResultKind.asset),
        isTrue,
      );
    });

    test('搜索命中交易所类', () async {
      final List<WhaleSearchResult> res = await repo.search('binance');
      expect(
        res.any(
            (WhaleSearchResult r) => r.kind == WhaleSearchResultKind.exchange),
        isTrue,
      );
    });

    test('搜索命中事件类型类', () async {
      final List<WhaleSearchResult> res = await repo.search('大额转入');
      expect(
        res.any(
            (WhaleSearchResult r) => r.kind == WhaleSearchResultKind.eventType),
        isTrue,
      );
    });

    test('搜索大小写不敏感', () async {
      final List<WhaleSearchResult> lower = await repo.search('btc');
      final List<WhaleSearchResult> upper = await repo.search('BTC');
      expect(lower.length, upper.length);
      expect(lower, isNotEmpty);
    });

    test('无命中返回空列表', () async {
      expect(await repo.search('zzz-nonexistent-xyz'), isEmpty);
    });

    test('WatchRule.copyWith 只改指定字段', () {
      const WatchRule base = WatchRule(
        id: 'x',
        name: 'n',
        address: 'a',
        lastEventDisplay: 'e',
        tone: 'up',
        pnlDisplay: 'p',
        live: false,
        thresholdUsd: 100,
        direction: WatchRuleDirection.both,
        channels: <WatchRuleChannel>{WatchRuleChannel.push},
        muted: false,
      );
      final WatchRule muted = base.copyWith(muted: true);
      expect(muted.muted, isTrue);
      expect(muted.id, 'x');
      expect(muted.thresholdUsd, 100);
      expect(muted.address, 'a');
    });
  });
}
