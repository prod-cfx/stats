import '../models/whale_profile_models.dart';

/// 巨鲸地址画像 Repository 接口（#1753）。
///
/// 真实模式走 API snapshot；测试替身模式走 `test WhaleProfileRepository`。
abstract class WhaleProfileRepository {
  /// 按缩写地址获取画像。未命中已知地址时由实现给出占位画像。
  Future<WhaleProfile> getProfile(String address);
}
