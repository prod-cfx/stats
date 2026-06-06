import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter/foundation.dart';

import '../models/whale_extra_models.dart';
import '../repositories/whale_extras_repository.dart';
import '../services/generated_backend_api.dart';

/// [WhaleExtrasRepository] 真实现（issue #2270）。
///
/// 经 generated [WhaleNotificationApi] 调真实 backend 收件箱端点，把
/// [WhaleNotificationInboxResponseDto] 映射为通知中心模型 [WhaleNotification]。
/// 端点直接返回列表（无 wrapper）。SmartMoney/Trending/Flow 等附属列表无端点，
/// 不在本接口范围。
class ApiWhaleExtrasRepository implements WhaleExtrasRepository {
  ApiWhaleExtrasRepository(this._api);

  final GeneratedBackendApi _api;

  @override
  Future<List<WhaleNotification>> listNotifications() async {
    final response = await _api.client
        .getWhaleNotificationApi()
        .whaleNotificationInboxControllerList();
    final List<WhaleNotificationInboxResponseDto> data =
        response.data?.toList() ?? const <WhaleNotificationInboxResponseDto>[];
    return data.map(mapNotification).toList(growable: false);
  }

  /// 契约 DTO → [WhaleNotification]。kind 按 content 关键字派生；契约无方向
  /// 信息，tone 固定 `'neutral'`。
  @visibleForTesting
  static WhaleNotification mapNotification(
    WhaleNotificationInboxResponseDto dto,
  ) {
    return WhaleNotification(
      id: dto.id,
      kind: _kind(dto.content),
      tone: 'neutral',
      unread: !dto.read,
      title: dto.title,
      body: dto.content,
      meta: dto.createdAt,
    );
  }

  static WhaleNotificationKind _kind(String content) {
    if (content.contains('流入') ||
        content.contains('流出') ||
        content.contains('转账') ||
        content.toLowerCase().contains('flow')) {
      return WhaleNotificationKind.flow;
    }
    if (content.contains('监控') || content.toLowerCase().contains('watch')) {
      return WhaleNotificationKind.watch;
    }
    if (content.contains('告警') ||
        content.contains('警报') ||
        content.toLowerCase().contains('alert')) {
      return WhaleNotificationKind.alert;
    }
    return WhaleNotificationKind.system;
  }
}
