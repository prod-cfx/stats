import 'package:flutter_riverpod/flutter_riverpod.dart';

/// `USE_MOCK` 启动开关。
///
/// 严格解析：只有显式传入 `false`（不区分大小写）才视为关闭 mock，
/// 其它任何值（含缺省）一律视为 mock 模式。
///
/// 使用方式：`flutter run --dart-define=USE_MOCK=false`
const String _kUseMockEnv = String.fromEnvironment(
  'USE_MOCK',
  defaultValue: 'false',
);

final Provider<bool> useMockProvider = Provider<bool>((Ref ref) {
  return _kUseMockEnv.toLowerCase() != 'false';
});
