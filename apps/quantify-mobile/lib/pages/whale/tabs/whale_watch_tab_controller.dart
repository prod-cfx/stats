import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/error_router.dart';
import '../../../core/providers/notifier_lifecycle.dart';
import '../../../data/models/whale_watch_models.dart';
import '../../../data/providers.dart';
import 'whale_watch_tab_state.dart';

/// 监控 tab 控制器（issue #2183 三件套迁移）。
///
/// `build()` 内发起规则加载（替换原 `initState` + `_load`）；异步回调前用
/// [NotifierLifecycle] 的 `mounted` 守卫，异常经 `ErrorRouter.normalize` 落
/// `state.error`。CRUD 弹窗等 context 副作用留在 widget，widget 拿到结果后调用
/// 本控制器的纯态方法（[appendRule]/[replaceRule]/[toggleMute]/[removeRule]）。
class WhaleWatchTabController extends Notifier<WhaleWatchTabState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  WhaleWatchTabState build() {
    _life.attach(ref);
    _load();
    return const WhaleWatchTabState();
  }

  Future<void> _load() async {
    try {
      final List<WatchRule> rules = await ref
          .read(whaleWatchRepositoryProvider)
          .listRules();
      if (!mounted) return;
      state = state.copyWith(rules: rules, loading: false, error: null);
    } catch (error) {
      if (!mounted) return;
      state = state.copyWith(
        loading: false,
        error: ErrorRouter.normalize(error),
      );
    }
  }

  void setSubTab(WhaleWatchSubTab tab) {
    state = state.copyWith(subTab: tab);
  }

  Future<void> appendRule(WatchRule rule) async {
    try {
      final WatchRule created = await ref
          .read(whaleWatchRepositoryProvider)
          .createRule(rule);
      if (!mounted) return;
      state = state.copyWith(rules: <WatchRule>[...?state.rules, created]);
    } catch (error) {
      if (!mounted) return;
      state = state.copyWith(error: ErrorRouter.normalize(error));
    }
  }

  Future<void> replaceRule(WatchRule updated) async {
    try {
      final WatchRule saved = await ref
          .read(whaleWatchRepositoryProvider)
          .updateRule(updated);
      if (!mounted) return;
      state = state.copyWith(
        rules: <WatchRule>[
          for (final WatchRule r in state.rules ?? <WatchRule>[])
            if (r.id == saved.id) saved else r,
        ],
      );
    } catch (error) {
      if (!mounted) return;
      state = state.copyWith(error: ErrorRouter.normalize(error));
    }
  }

  Future<void> toggleMute(WatchRule rule) async {
    await replaceRule(rule.copyWith(muted: !rule.muted));
  }

  Future<void> removeRule(WatchRule rule) async {
    try {
      await ref.read(whaleWatchRepositoryProvider).deleteRule(rule);
      if (!mounted) return;
      state = state.copyWith(
        rules: <WatchRule>[
          for (final WatchRule r in state.rules ?? <WatchRule>[])
            if (r.id != rule.id) r,
        ],
      );
    } catch (error) {
      if (!mounted) return;
      state = state.copyWith(error: ErrorRouter.normalize(error));
    }
  }
}

final whaleWatchTabControllerProvider =
    NotifierProvider.autoDispose<WhaleWatchTabController, WhaleWatchTabState>(
      WhaleWatchTabController.new,
    );
