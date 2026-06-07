import 'package:flutter_riverpod/flutter_riverpod.dart';

/// `USE_MOCK` 启动开关。
///
/// 缺省（未传 `--dart-define`）即 `defaultValue:'false'`，等价于关闭 mock、
/// 走真实接口（#2266 staging 默认决策）。`_kUseMockEnv.toLowerCase() != 'false'`
/// 意为：只有显式传入非 `false`（不区分大小写）的值时才启用 mock 模式。
///
/// 使用方式：默认走真实接口；如需 mock 显式 `flutter run --dart-define=USE_MOCK=true`。
const String _kUseMockEnv = String.fromEnvironment(
  'USE_MOCK',
  defaultValue: 'false',
);

final Provider<bool> useMockProvider = Provider<bool>((Ref ref) {
  return _kUseMockEnv.toLowerCase() != 'false';
});
