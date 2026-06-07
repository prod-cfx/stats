import 'package:riverpod/misc.dart' show Override;
import 'package:quantify_mobile/data/providers.dart';

/// 统一的测试 mock override。
///
/// #2266 把 `USE_MOCK` 默认值翻成 `'false'`（默认真实接口）后，依赖「默认 mock」
/// 的存量测试会装配 `Api*` 真实现而失败。测试若需要 mock 仓库，须显式声明本
/// override，把 [useMockProvider] 固定为 `true`，与生产默认解耦。
final Override useMockOverride = useMockProvider.overrideWithValue(true);
