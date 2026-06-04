import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import '../../data/mock/fixtures/whale_extras.dart';
import '../../data/models/whale_extra_models.dart';
import 'data_hub_page_state.dart';
import 'widgets/data_hub_header.dart' show DataHubScreen;

/// 「数据」hub 控制器（issue #2184）。纯同步：切子屏 / 更新通知列表。
///
/// `initial` 子屏由 widget 经 family arg 注入（底栏 market tab 默认进 market；
/// `/market/long-short` 深链传 longShort 预选多空比，#1853）。
class DataHubController extends Notifier<DataHubState> {
  DataHubController(this.initial);

  final DataHubScreen initial;

  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  DataHubState build() {
    _life.attach(ref);
    return DataHubState(
      current: initial,
      notifications: List<WhaleNotification>.of(mockWhaleNotifications),
    );
  }

  void select(DataHubScreen screen) {
    state = state.copyWith(current: screen);
  }

  void setNotifications(List<WhaleNotification> notifications) {
    state = state.copyWith(notifications: notifications);
  }
}

final dataHubControllerProvider = NotifierProvider.autoDispose
    .family<DataHubController, DataHubState, DataHubScreen>(
      DataHubController.new,
    );
