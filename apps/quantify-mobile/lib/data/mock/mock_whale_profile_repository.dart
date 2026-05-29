import '../models/whale_profile_models.dart';
import '../repositories/whale_profile_repository.dart';
import 'fixtures/whale_profiles.dart';

/// 巨鲸地址画像 mock 实现（#1753）。
///
/// 命中 [mockWhaleProfiles] 的缩写地址直接返回；未命中走
/// [buildFallbackWhaleProfile] 派生占位，保证任意可点击地址都有详情。
/// 真实读路径依赖 #1682，接通后整体替换。
class MockWhaleProfileRepository implements WhaleProfileRepository {
  @override
  Future<WhaleProfile> getProfile(String address) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return mockWhaleProfiles[address] ?? buildFallbackWhaleProfile(address);
  }
}
