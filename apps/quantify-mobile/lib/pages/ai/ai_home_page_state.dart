import 'package:flutter/foundation.dart';

import '../../data/models/ai_chat_models.dart';

/// AI 多会话对话页的不可变页面态（issue #2186 三件套迁移）。
///
/// 承载会话集合（[sessions]/[order]/[currentId]/[drafts]）与流式态
/// （[isThinking]/[isStreaming]）+ 初始化/加载哨兵（[initialized]/
/// [lastLoadedStrategyId]）。`_streamTimer` 由 controller 持有，不属状态。
/// `_input`/`_scroll` 等渲染层 controller 留在 widget，不进此处。
@immutable
class AiHomePageState {
  const AiHomePageState({
    this.sessions = const <String, AiSession>{},
    this.order = const <String>[],
    this.currentId,
    this.drafts = const <String, String>{},
    this.isThinking = false,
    this.isStreaming = false,
    this.initialized = false,
    this.lastLoadedStrategyId,
  });

  final Map<String, AiSession> sessions;

  /// 会话排序（按 updatedAt 倒序）。
  final List<String> order;

  /// 当前会话 id；null = 无会话（走空态）。
  final String? currentId;

  /// 每个会话独立的输入草稿（sessionId → 文本）。
  final Map<String, String> drafts;

  final bool isThinking;
  final bool isStreaming;

  /// listSessions 是否已完成首帧加载。
  final bool initialized;

  /// 已处理过的 `?loadStrategy=<id>`，避免重复注入。
  final String? lastLoadedStrategyId;

  bool get isSending => isThinking || isStreaming;

  /// 按 [order] 投影出有序会话列表。
  List<AiSession> get orderedSessions => <AiSession>[
    for (final String id in order)
      if (sessions[id] != null) sessions[id]!,
  ];

  /// [currentId] / [lastLoadedStrategyId] 用 [_unset] 哨兵区分「不改动」与
  /// 「显式置 null」；其余 Map/List 直接整体替换（controller 已构造新实例）。
  AiHomePageState copyWith({
    Map<String, AiSession>? sessions,
    List<String>? order,
    Object? currentId = _unset,
    Map<String, String>? drafts,
    bool? isThinking,
    bool? isStreaming,
    bool? initialized,
    Object? lastLoadedStrategyId = _unset,
  }) {
    return AiHomePageState(
      sessions: sessions ?? this.sessions,
      order: order ?? this.order,
      currentId: identical(currentId, _unset)
          ? this.currentId
          : currentId as String?,
      drafts: drafts ?? this.drafts,
      isThinking: isThinking ?? this.isThinking,
      isStreaming: isStreaming ?? this.isStreaming,
      initialized: initialized ?? this.initialized,
      lastLoadedStrategyId: identical(lastLoadedStrategyId, _unset)
          ? this.lastLoadedStrategyId
          : lastLoadedStrategyId as String?,
    );
  }

  static const Object _unset = Object();
}
