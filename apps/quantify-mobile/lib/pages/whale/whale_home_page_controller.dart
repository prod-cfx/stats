import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import 'whale_home_page_state.dart';

/// 巨鲸首页控制器（issue #2183 三件套迁移）。
///
/// 纯同步导航态：[selectTab] 切换二级 tab。无异步、无 `BuildContext`。挂
/// [NotifierLifecycle] 对齐范式（本控制器无异步回调，登记仅为统一约定）。
class WhaleHomePageController extends Notifier<WhaleHomePageState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  WhaleHomePageState build() {
    _life.attach(ref);
    return const WhaleHomePageState();
  }

  void selectTab(int index) {
    state = state.copyWith(tabIndex: index);
  }
}

final whaleHomePageControllerProvider =
    NotifierProvider.autoDispose<WhaleHomePageController, WhaleHomePageState>(
      WhaleHomePageController.new,
    );
