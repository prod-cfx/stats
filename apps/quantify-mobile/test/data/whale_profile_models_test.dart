import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_profiles.dart';
import 'package:quantify_mobile/data/models/whale_profile_models.dart';

/// 巨鲸明细数据底座守护（#1858）。条数对齐设计稿，
/// 守护数值字段与展示串符号一致，并保证 fallback 空态不空。
void main() {
  group('WhaleProfile 明细数据底座（0x88e…3a01 1:1 fixture）', () {
    final WhaleProfile p = mockWhaleProfiles['0x88e…3a01']!;

    test('各 tab 明细条数与设计稿一致', () {
      expect(p.spotHoldings.length, 3);
      expect(p.perpHoldings.length, 2);
      expect(p.openOrders.length, 3);
      expect(p.recentTrades.length, 3);
      expect(p.histOrders.length, 3);
    });

    test('资产表现 6 条 / 仓位表现 5 条', () {
      expect(p.stats.assetPerf.length, 6);
      expect(p.stats.positionPerf.length, 5);
    });

    test('PnL 曲线 19 点 / stat 卡 / 永续总价值齐备', () {
      expect(p.pnlCurve.length, 19);
      expect(p.statCards, isNotNull);
      expect(p.perpSummary, isNotNull);
    });

    test('永续总价值方向占比和为 100', () {
      expect(p.perpSummary!.longPct + p.perpSummary!.shortPct, 100);
    });

    test('胜率卡 / 交易次数拆分自洽（wins + losses == tradesTotal）', () {
      expect(p.stats.wins! + p.stats.losses!, p.stats.tradesTotal);
      expect(p.stats.closedPnlDisplay, isNotNull);
      expect(p.stats.feeAdjustedPnlDisplay, isNotNull);
    });

    test('永续持仓数值与展示串符号一致（pnlN<0 → display 带 -）', () {
      for (final WhalePerpHolding h in p.perpHoldings) {
        if (h.pnlN < 0) {
          expect(h.pnlDisplay.startsWith('-'), isTrue,
              reason: '${h.sym} pnlN<0 但 pnlDisplay 未带负号');
        } else {
          expect(h.pnlDisplay.startsWith('-'), isFalse,
              reason: '${h.sym} pnlN>=0 但 pnlDisplay 带负号');
        }
      }
    });

    test('成交数值与展示串符号一致（pnlN>=0 → display 不带 -）', () {
      for (final WhaleRecentTrade t in p.recentTrades) {
        if (t.pnlN >= 0) {
          expect(t.pnlDisplay.startsWith('-'), isFalse,
              reason: '${t.id} pnlN>=0 但 pnlDisplay 带负号');
        }
      }
    });
  });

  group('方向偏好守护（既有约定沿用）', () {
    test('stats.longPct + shortPct == 100', () {
      for (final WhaleProfile p in mockWhaleProfiles.values) {
        expect(p.stats.longPct + p.stats.shortPct, 100,
            reason: '${p.address} 方向偏好占比应和为 100');
      }
    });
  });

  group('fallback 画像空态不空', () {
    final WhaleProfile p = buildFallbackWhaleProfile('0xdead…beef');

    test('各类明细均非空', () {
      expect(p.spotHoldings, isNotEmpty);
      expect(p.perpHoldings, isNotEmpty);
      expect(p.openOrders, isNotEmpty);
      expect(p.recentTrades, isNotEmpty);
      expect(p.histOrders, isNotEmpty);
      expect(p.pnlCurve, isNotEmpty);
      expect(p.stats.positionPerf, isNotEmpty);
      expect(p.statCards, isNotNull);
      expect(p.perpSummary, isNotNull);
    });
  });
}
