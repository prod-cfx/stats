import 'package:flutter/foundation.dart';

import '../../data/models/whale_extra_models.dart';
import 'widgets/data_hub_header.dart' show DataHubScreen;

/// 「数据」hub 不可变页面态：当前子屏 [current] 与通知列表 [notifications]
/// （unread badge 真值来源，issue #2184）。
@immutable
class DataHubState {
  const DataHubState({
    required this.current,
    required this.notifications,
  });

  final DataHubScreen current;
  final List<WhaleNotification> notifications;

  int get unreadCount =>
      notifications.where((WhaleNotification n) => n.unread).length;

  DataHubState copyWith({
    DataHubScreen? current,
    List<WhaleNotification>? notifications,
  }) {
    return DataHubState(
      current: current ?? this.current,
      notifications: notifications ?? this.notifications,
    );
  }
}
