import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Riverpod 主线 `Notifier` / `AsyncNotifier` 的轻量生命周期持锁，等价于旧
/// `StateNotifier.mounted`。
///
/// 主线 `Notifier` 没有公开 `mounted` getter（仅 ProviderElement 内部维护），
/// 但业务 controller 常用 `if (!mounted) return;` 守卫异步回调，避免在 dispose
/// 后触达 `state =` 抛 `StateError`。迁移时保留该语义，用 `NotifierLifecycle`
/// 显式登记。
///
/// 用法：
/// ```
/// class FooController extends Notifier<FooState> {
///   final _life = NotifierLifecycle();
///   bool get mounted => _life.mounted;
///
///   @override
///   FooState build() {
///     _life.attach(ref);
///     return const FooState();
///   }
///
///   Future<void> load() async {
///     ...
///     if (!mounted) return;
///     state = ...;
///   }
/// }
/// ```
///
/// 与旧 `StateNotifier.mounted` 等价：`attach` 后为 true，`ref.onDispose`
/// 触发时复位为 false。
class NotifierLifecycle {
  bool _mounted = false;

  /// 在 `build()` 入口调用一次：登记 mounted=true，并注册 onDispose 复位。
  void attach(Ref ref) {
    _mounted = true;
    ref.onDispose(() => _mounted = false);
  }

  /// 与旧 `StateNotifier.mounted` 等价：attach 完成后为 true，dispose 后为 false。
  bool get mounted => _mounted;
}
