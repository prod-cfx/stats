import '../models/whale_profile_models.dart';

/// 巨鲸地址画像 Repository 接口（#1753）。
///
/// 真实读路径依赖 #1682；接通前由 `MockWhaleProfileRepository` 驱动。
abstract class WhaleProfileRepository {
  /// 按缩写地址获取画像。未命中已知地址时由实现给出占位画像。
  Future<WhaleProfile> getProfile(String address);
}
