import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/domain/models/whale_leader_models.dart';
import 'package:quantify_mobile/domain/use_cases/whale_leader_use_cases.dart';

WhaleLeaderEntry _entry({
  String id = '0x1',
  double aum = 100,
  double pnl = 10,
  double winRate = 50,
  int trades = 10,
  bool pnlPositive = true,
  String? avatarText,
}) {
  return WhaleLeaderEntry(
    id: id,
    aumDisplay: '\$$aum',
    aumValue: aum,
    pnlDisplay: pnl >= 0 ? '+\$$pnl万' : '-\$${pnl.abs()}万',
    pnlValue: pnl,
    pnlPositive: pnlPositive,
    trades: trades,
    positions: 3,
    winRate: winRate,
    tags: const <String>['ai'],
    avatarText: avatarText,
  );
}

void main() {
  group('sortWhaleLeaders', () {
    test('空输入返回空', () {
      expect(sortWhaleLeaders(const <WhaleLeaderEntry>[], null), isEmpty);
    });

    test('null sort 原序副本', () {
      final list = <WhaleLeaderEntry>[_entry(aum: 1), _entry(aum: 3)];
      final out = sortWhaleLeaders(list, null);
      expect(out.map((e) => e.aumValue).toList(), <double>[1, 3]);
      expect(identical(out, list), isFalse);
    });

    test('按 winRate desc', () {
      final list = <WhaleLeaderEntry>[
        _entry(winRate: 10),
        _entry(winRate: 90),
        _entry(winRate: 50),
      ];
      final out = sortWhaleLeaders(
        list,
        const WhaleLeaderSort(
            key: WhaleLeaderSortKey.winRate, dir: WhaleLeaderSortDir.desc),
      );
      expect(out.map((e) => e.winRate).toList(), <double>[90, 50, 10]);
    });

    test('按 aum asc', () {
      final list = <WhaleLeaderEntry>[_entry(aum: 30), _entry(aum: 10)];
      final out = sortWhaleLeaders(
        list,
        const WhaleLeaderSort(
            key: WhaleLeaderSortKey.aum, dir: WhaleLeaderSortDir.asc),
      );
      expect(out.map((e) => e.aumValue).toList(), <double>[10, 30]);
    });

    test('按 pnl desc（含负值）', () {
      final list = <WhaleLeaderEntry>[_entry(pnl: -5), _entry(pnl: 8)];
      final out = sortWhaleLeaders(
        list,
        const WhaleLeaderSort(
            key: WhaleLeaderSortKey.pnl, dir: WhaleLeaderSortDir.desc),
      );
      expect(out.map((e) => e.pnlValue).toList(), <double>[8, -5]);
    });

    test('不修改入参', () {
      final list = <WhaleLeaderEntry>[_entry(aum: 1), _entry(aum: 3)];
      sortWhaleLeaders(
        list,
        const WhaleLeaderSort(
            key: WhaleLeaderSortKey.aum, dir: WhaleLeaderSortDir.desc),
      );
      expect(list.map((e) => e.aumValue).toList(), <double>[1, 3]);
    });
  });

  group('topWhaleLeaders', () {
    test('空输入返回空', () {
      expect(topWhaleLeaders(const <WhaleLeaderEntry>[]), isEmpty);
    });

    test('仅保留带 avatarText 的条目', () {
      final list = <WhaleLeaderEntry>[
        _entry(id: 'a', avatarText: 'A'),
        _entry(id: 'b'),
        _entry(id: 'c', avatarText: 'C'),
      ];
      expect(
        topWhaleLeaders(list).map((e) => e.id).toList(),
        <String>['a', 'c'],
      );
    });

    test('无 avatarText 全过滤为空', () {
      final list = <WhaleLeaderEntry>[_entry(), _entry()];
      expect(topWhaleLeaders(list), isEmpty);
    });
  });

  group('whaleLeaderTradeStats', () {
    test('正盈亏 tone=up，wins 按胜率计算', () {
      final stats = whaleLeaderTradeStats(
        _entry(trades: 10, winRate: 70, pnlPositive: true),
      );
      expect(stats.pnlTone, 'up');
      expect(stats.tradesTotal, 10);
      expect(stats.wins, 7);
      expect(stats.losses, 3);
    });

    test('负盈亏 tone=dn', () {
      final stats = whaleLeaderTradeStats(_entry(pnlPositive: false));
      expect(stats.pnlTone, 'dn');
    });
  });
}
