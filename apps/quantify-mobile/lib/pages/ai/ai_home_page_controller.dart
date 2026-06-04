import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import '../../data/models/ai_chat_models.dart';
import '../../data/models/strategy_models.dart';
import '../../data/providers.dart';
import '../../data/repositories/ai_chat_repository.dart';
import '../../data/repositories/strategy_repository.dart';
import 'ai_home_page_state.dart';

/// AI 多会话对话页控制器（issue #2186 三件套迁移）。
///
/// 持有会话集合 + 流式态，经 `ref.read(aiChatRepositoryProvider)` /
/// `strategyRepositoryProvider` 取数。流式逐字由 controller 持有的
/// [_streamTimer] 驱动，`ref.onDispose` 中取消；异步回调前以
/// [NotifierLifecycle] mounted 守卫。
///
/// 边界：导航 / `TextEditingController` / `ScrollController` / drawer pop 等
/// 渲染层副作用留在 widget；本控制器只推进 [AiHomePageState]。
class AiHomePageController extends Notifier<AiHomePageState> {
  /// Streaming cadence: 1 char / 250 ms（保留 #1508 节奏）。
  static const Duration streamTick = Duration(milliseconds: 250);

  final NotifierLifecycle _life = NotifierLifecycle();
  Timer? _streamTimer;

  bool get mounted => _life.mounted;

  AiChatRepository get _chatRepo => ref.read(aiChatRepositoryProvider);
  StrategyRepository get _strategyRepo => ref.read(strategyRepositoryProvider);

  @override
  AiHomePageState build() {
    _life.attach(ref);
    ref.onDispose(() => _streamTimer?.cancel());
    return const AiHomePageState();
  }

  String draftFor(String? id) => id == null ? '' : (state.drafts[id] ?? '');

  /// 写当前会话草稿（widget 的 `_input` listener 调用）。
  void persistDraft(String text) {
    final String? id = state.currentId;
    if (id == null) return;
    state = state.copyWith(
      drafts: <String, String>{...state.drafts, id: text},
    );
  }

  /// 标记已处理的 loadStrategy query，避免重复注入。
  void markLoadedStrategy(String id) {
    state = state.copyWith(lastLoadedStrategyId: id);
  }

  Future<void> loadSessions() async {
    final List<AiSession> list = await _chatRepo.listSessions();
    if (!mounted) return;
    state = state.copyWith(
      sessions: <String, AiSession>{
        for (final AiSession s in list) s.id: s,
      },
      order: <String>[for (final AiSession s in list) s.id],
      currentId: list.isNotEmpty ? list.first.id : null,
      initialized: true,
    );
  }

  /// 切会话；返回是否真正切换（false = 点中当前会话，widget 仅关 drawer）。
  bool switchSession(String id) {
    if (id == state.currentId) return false;
    _streamTimer?.cancel();
    state = state.copyWith(
      currentId: id,
      isThinking: false,
      isStreaming: false,
    );
    return true;
  }

  Future<void> createSession(String untitledTitle) async {
    final AiSession fresh = await _chatRepo.createSession(title: untitledTitle);
    if (!mounted) return;
    state = state.copyWith(
      sessions: <String, AiSession>{...state.sessions, fresh.id: fresh},
      order: <String>[fresh.id, ...state.order],
      currentId: fresh.id,
    );
  }

  Future<void> deleteSession(String id) async {
    await _chatRepo.deleteSession(id);
    if (!mounted) return;
    final Map<String, AiSession> sessions =
        Map<String, AiSession>.of(state.sessions)..remove(id);
    final List<String> order = List<String>.of(state.order)..remove(id);
    final Map<String, String> drafts = Map<String, String>.of(state.drafts)
      ..remove(id);
    String? currentId = state.currentId;
    if (currentId == id) {
      currentId = order.isNotEmpty ? order.first : null;
    }
    state = state.copyWith(
      sessions: sessions,
      order: order,
      drafts: drafts,
      currentId: currentId,
    );
  }

  /// 发送一条消息：追加 user turn → thinking → 取 reply → 逐字 streaming → done。
  ///
  /// [text] 已 trim；空文本或正在发送时由调用方守卫（此处再兜一层）。
  Future<void> send(String text) async {
    final String? id = state.currentId;
    if (id == null) return;
    if (text.isEmpty || state.isSending) return;

    final ChatTurn userTurn = ChatTurn(
      id: 'user-${DateTime.now().microsecondsSinceEpoch}',
      role: 'user',
      content: text,
      timestamp: DateTime.now(),
    );
    final AiSession? cur = state.sessions[id];
    if (cur == null) return;
    state = state.copyWith(
      sessions: <String, AiSession>{
        ...state.sessions,
        id: cur.copyWith(
          messages: <ChatTurn>[...cur.messages, userTurn],
          updatedAt: DateTime.now(),
        ),
      },
      isThinking: true,
      drafts: <String, String>{...state.drafts, id: ''},
    );

    ChatTurn reply;
    try {
      reply = await _chatRepo.sendMessageTo(id, userTurn);
    } catch (_) {
      if (!mounted) return;
      state = state.copyWith(isThinking: false);
      return;
    }
    if (!mounted) return;

    final AiSession? cur2 = state.sessions[id];
    if (cur2 == null) {
      state = state.copyWith(isThinking: false);
      return;
    }
    // mock 已把 userTurn + reply 都追加；剥掉 reply 再插入空内容以逐字铺。
    final List<ChatTurn> base = List<ChatTurn>.of(cur2.messages);
    if (base.isNotEmpty && base.last.id == reply.id) base.removeLast();
    final int idx = base.length;
    state = state.copyWith(
      sessions: <String, AiSession>{
        ...state.sessions,
        id: cur2.copyWith(
          messages: <ChatTurn>[...base, _replyWith(reply, '')],
        ),
      },
      isThinking: false,
      isStreaming: true,
    );

    final String full = reply.content;
    int cursor = 0;
    _streamTimer?.cancel();
    _streamTimer = Timer.periodic(streamTick, (Timer t) {
      cursor++;
      if (!mounted) {
        t.cancel();
        return;
      }
      final AiSession? s = state.sessions[id];
      if (s == null) {
        t.cancel();
        return;
      }
      final List<ChatTurn> msgs = List<ChatTurn>.of(s.messages);
      if (idx >= msgs.length) {
        t.cancel();
        return;
      }
      if (cursor >= full.length) {
        t.cancel();
        msgs[idx] = _replyWith(reply, full);
        state = state.copyWith(
          sessions: <String, AiSession>{
            ...state.sessions,
            id: s.copyWith(messages: msgs),
          },
          isStreaming: false,
        );
        return;
      }
      msgs[idx] = _replyWith(reply, full.substring(0, cursor));
      state = state.copyWith(
        sessions: <String, AiSession>{
          ...state.sessions,
          id: s.copyWith(messages: msgs),
        },
      );
    });
  }

  /// 处理 `?loadStrategy=<id>`：拉策略详情 → 选/建会话 → 注入预设两条消息。
  Future<void> handleLoadStrategy(
    String id, {
    required String Function(String name, String category, String tags)
    userMessage,
    required String Function(String name) replyMessage,
    required String newSessionTitleFallback,
  }) async {
    if (!state.initialized) return;
    StrategyDetail detail;
    try {
      detail = await _strategyRepo.getStrategyDetail(id);
    } catch (_) {
      return;
    }
    if (!mounted) return;

    String targetId;
    final AiSession? cur = state.currentId == null
        ? null
        : state.sessions[state.currentId!];
    final bool curIsEmpty =
        cur != null &&
        cur.messages.length <= 1 &&
        cur.messages.every((ChatTurn t) => t.role == 'assistant');
    if (cur != null && curIsEmpty) {
      targetId = cur.id;
    } else {
      final AiSession fresh = await _chatRepo.createSession(
        title: detail.card.name,
      );
      if (!mounted) return;
      state = state.copyWith(
        sessions: <String, AiSession>{...state.sessions, fresh.id: fresh},
        order: <String>[fresh.id, ...state.order],
        currentId: fresh.id,
      );
      targetId = fresh.id;
    }

    final String tagsStr = detail.card.tags.isEmpty
        ? '-'
        : detail.card.tags.take(3).join(' / ');
    final String userText = userMessage(
      detail.card.name,
      detail.card.category.name,
      tagsStr,
    );
    final String replyText = replyMessage(detail.card.name);

    final DateTime now = DateTime.now();
    final ChatTurn userTurn = ChatTurn(
      id: 'load-user-${now.microsecondsSinceEpoch}',
      role: 'user',
      content: userText,
      timestamp: now,
    );
    final ChatTurn paramsTurn = ChatTurn(
      id: 'load-params-${now.microsecondsSinceEpoch + 1}',
      role: 'assistant',
      content: replyText,
      timestamp: now.add(const Duration(milliseconds: 1)),
      kind: ChatTurnKind.params,
      params: <String, String>{
        'category': detail.card.category.name,
        'fast_ma': '5',
        'slow_ma': '20',
        'stop_loss': '2.0%',
        'position': '100%',
      },
    );

    final AiSession? target = state.sessions[targetId];
    if (target == null) return;
    state = state.copyWith(
      sessions: <String, AiSession>{
        ...state.sessions,
        targetId: target.copyWith(
          messages: <ChatTurn>[...target.messages, userTurn, paramsTurn],
          updatedAt: now,
        ),
      },
    );
  }

  /// 用新内容克隆 reply turn（保留 kind/params/deployed 字段）。
  ChatTurn _replyWith(ChatTurn reply, String content) => ChatTurn(
    id: reply.id,
    role: reply.role,
    content: content,
    timestamp: reply.timestamp,
    kind: reply.kind,
    params: reply.params,
    deployedExchange: reply.deployedExchange,
    deployedInstanceId: reply.deployedInstanceId,
  );
}

final aiHomePageControllerProvider =
    NotifierProvider.autoDispose<AiHomePageController, AiHomePageState>(
      AiHomePageController.new,
    );
