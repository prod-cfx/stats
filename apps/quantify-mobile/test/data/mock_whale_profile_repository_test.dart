import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_profiles.dart';
import 'package:quantify_mobile/data/mock/mock_whale_profile_repository.dart';
import 'package:quantify_mobile/data/models/whale_profile_models.dart';

void main() {
  group('MockWhaleProfileRepository', () {
    test('命中已知地址返回对应 fixture 画像', () async {
      final MockWhaleProfileRepository repo = MockWhaleProfileRepository();
      final WhaleProfile p = await repo.getProfile('0x88e…3a01');
      expect(p.address, '0x88e…3a01');
      expect(p.tag, '机构');
      expect(p.holdings, isNotEmpty);
      expect(p.stats.winRatePct, inInclusiveRange(0, 100));
    });

    test('未命中地址返回基于该地址派生的 fallback 画像（空态不空）', () async {
      final MockWhaleProfileRepository repo = MockWhaleProfileRepository();
      const String unknown = '0xdead…beef';
      final WhaleProfile p = await repo.getProfile(unknown);
      expect(p.address, unknown);
      expect(p.holdings, isNotEmpty);
      expect(p.recentActions, isNotEmpty);
      expect(p.stats.assetPerf, isNotEmpty);
    });

    test('方向偏好 long/short 占比和为 100（fixture 守护）', () {
      for (final WhaleProfile p in mockWhaleProfiles.values) {
        expect(
          p.stats.longPct + p.stats.shortPct,
          100,
          reason: '${p.address} 方向偏好占比应和为 100',
        );
      }
    });
  });
}
