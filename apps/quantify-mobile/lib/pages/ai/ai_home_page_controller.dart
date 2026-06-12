import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/error/error_router.dart';
import '../../core/providers/notifier_lifecycle.dart';
import '../../data/models/ai_chat_models.dart';
import '../../data/models/strategy_models.dart';
import '../../data/providers.dart';
import '../../data/repositories/ai_chat_repository.dart';
import '../../data/repositories/strategy_repository.dart';
import '../../data/services/api_client.dart';
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
  static const int _publishPollLimit = 80;
  static const Duration _publishPollInterval = Duration(milliseconds: 1500);

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
    state = state.copyWith(drafts: <String, String>{...state.drafts, id: text});
  }

  /// 标记已处理的 loadStrategy query，避免重复注入。
  void markLoadedStrategy(String id) {
    state = state.copyWith(lastLoadedStrategyId: id);
  }

  Future<void> loadSessions() async {
    state = state.copyWith(loadError: null, initialized: false);
    List<AiSession> list;
    try {
      list = await _chatRepo.listSessions();
    } catch (error) {
      if (!mounted) return;
      state = state.copyWith(
        sessions: const <String, AiSession>{},
        order: const <String>[],
        currentId: null,
        initialized: true,
        loadError: ErrorRouter.normalize(error).message,
      );
      return;
    }
    if (!mounted) return;
    state = state.copyWith(
      sessions: <String, AiSession>{for (final AiSession s in list) s.id: s},
      order: <String>[for (final AiSession s in list) s.id],
      currentId: list.isNotEmpty ? list.first.id : null,
      initialized: true,
      loadError: null,
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
    _streamTimer?.cancel();
    final Map<String, String> drafts = Map<String, String>.of(state.drafts)
      ..remove(fresh.id);
    state = state.copyWith(
      sessions: <String, AiSession>{...state.sessions, fresh.id: fresh},
      order: <String>[fresh.id, ...state.order],
      currentId: fresh.id,
      drafts: drafts,
      isThinking: false,
      isStreaming: false,
    );
  }

  Future<void> deleteSession(String id) async {
    await _chatRepo.deleteSession(id);
    if (!mounted) return;
    final Map<String, AiSession> sessions = Map<String, AiSession>.of(
      state.sessions,
    )..remove(id);
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
    final String targetSessionId = _firstNonBlank(<String?>[
      cur.llmCodegenSessionId,
      id,
    ])!;
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
      reply = await _chatRepo.sendMessageTo(targetSessionId, userTurn);
    } catch (error) {
      if (!mounted) return;
      final AiSession? failed = state.sessions[id];
      if (failed == null) {
        state = state.copyWith(isThinking: false);
        return;
      }
      final String message = ErrorRouter.normalize(error).message;
      final ChatTurn errorTurn = ChatTurn(
        id: 'assistant-error-${DateTime.now().microsecondsSinceEpoch}',
        role: 'assistant',
        content: '发送失败：$message',
        timestamp: DateTime.now(),
      );
      state = state.copyWith(
        sessions: <String, AiSession>{
          ...state.sessions,
          id: failed.copyWith(
            messages: <ChatTurn>[...failed.messages, errorTurn],
            updatedAt: DateTime.now(),
          ),
        },
        isThinking: false,
      );
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
          llmCodegenSessionId: _firstNonBlank(<String?>[
            reply.codegenSessionId,
            cur2.llmCodegenSessionId,
          ]),
          pendingCanonicalDigest: _firstNonBlank(<String?>[
            reply.confirmedCanonicalDigest,
            cur2.pendingCanonicalDigest,
          ]),
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
            id: s.copyWith(
              messages: msgs,
              llmCodegenSessionId: _firstNonBlank(<String?>[
                reply.codegenSessionId,
                s.llmCodegenSessionId,
              ]),
              pendingCanonicalDigest: _firstNonBlank(<String?>[
                reply.confirmedCanonicalDigest,
                s.pendingCanonicalDigest,
              ]),
            ),
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

  Future<void> confirmStrategyInChat(
    String sessionId, {
    required String codegenSessionId,
    required String confirmedCanonicalDigest,
  }) async {
    if (state.isSending) return;
    final AiSession? cur = state.sessions[sessionId];
    if (cur == null) return;
    final DateTime now = DateTime.now();
    final ChatTurn userTurn = ChatTurn(
      id: 'confirm-user-${now.microsecondsSinceEpoch}',
      role: 'user',
      content: '确认策略',
      timestamp: now,
    );
    final ChatTurn pendingTurn = ChatTurn(
      id: 'confirm-pending-${now.microsecondsSinceEpoch + 1}',
      role: 'assistant',
      content: '已确认策略，正在生成策略脚本...',
      timestamp: now.add(const Duration(milliseconds: 1)),
      codegenSessionId: codegenSessionId,
      confirmedCanonicalDigest: confirmedCanonicalDigest,
    );

    state = state.copyWith(
      sessions: <String, AiSession>{
        ...state.sessions,
        sessionId: cur.copyWith(
          messages: <ChatTurn>[...cur.messages, userTurn, pendingTurn],
          updatedAt: now,
          llmCodegenSessionId: codegenSessionId,
          pendingCanonicalDigest: confirmedCanonicalDigest,
        ),
      },
      isThinking: true,
    );

    try {
      CodegenSessionResponseDto result;
      try {
        result = await _chatRepo.confirmStrategy(
          codegenSessionId,
          message: '确认策略',
          confirmedCanonicalDigest: confirmedCanonicalDigest,
        );
      } catch (error) {
        if (!_isConflictError(error)) rethrow;
        result = await _chatRepo.getCodegenSession(codegenSessionId);
      }
      result = await _waitForPublished(codegenSessionId, result);
      if (!mounted) return;
      _replaceAssistantTurn(
        sessionId,
        pendingTurn.id,
        _publishedScriptTurn(result),
        sessionPatch: (AiSession s) => s.copyWith(
          llmCodegenSessionId: result.id,
          pendingCanonicalDigest: result.canonicalDigest,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      _replaceAssistantTurn(
        sessionId,
        pendingTurn.id,
        ChatTurn(
          id: 'confirm-error-${DateTime.now().microsecondsSinceEpoch}',
          role: 'assistant',
          content: '脚本生成失败：${ErrorRouter.normalize(error).message}',
          timestamp: DateTime.now(),
        ),
      );
    } finally {
      if (mounted) state = state.copyWith(isThinking: false);
    }
  }

  Future<CodegenSessionResponseDto> _waitForPublished(
    String sessionId,
    CodegenSessionResponseDto initial,
  ) async {
    CodegenSessionResponseDto current = initial;
    for (int i = 0; i <= _publishPollLimit; i++) {
      if (current.status == CodegenSessionResponseDtoStatusEnum.PUBLISHED) {
        return current;
      }
      if (_isTerminalFailure(current.status)) {
        final String reason = current.rejectReason?.trim().isNotEmpty == true
            ? current.rejectReason!.trim()
            : '后端未返回失败原因';
        throw StateError(reason);
      }
      if (i == _publishPollLimit) break;
      await Future<void>.delayed(_publishPollInterval);
      try {
        current = await _chatRepo.getCodegenSession(sessionId);
      } catch (error) {
        if (!_isConflictError(error)) rethrow;
      }
    }
    throw TimeoutException('策略脚本生成超时，请稍后重试。');
  }

  bool _isTerminalFailure(CodegenSessionResponseDtoStatusEnum status) {
    return status == CodegenSessionResponseDtoStatusEnum.CONSISTENCY_FAILED ||
        status == CodegenSessionResponseDtoStatusEnum.REJECTED;
  }

  bool _isConflictError(Object error) {
    if (error is ApiException) return error.statusCode == 409;
    if (error is DioException) {
      final Object? inner = error.error;
      if (inner is ApiException && inner.statusCode == 409) return true;
      return error.response?.statusCode == 409;
    }
    final String text = error.toString();
    return text.contains('status=409') ||
        text.contains('HTTP 409') ||
        text.contains('CONFLICT');
  }

  ChatTurn _publishedScriptTurn(CodegenSessionResponseDto result) {
    final String script = result.scriptCode?.trim() ?? '';
    final String content = script.isEmpty
        ? '策略脚本已生成，可以开始回测。'
        : '策略脚本已生成，可以开始回测。\n\n```javascript\n$script\n```';
    return ChatTurn(
      id: 'published-script-${result.id}-${DateTime.now().microsecondsSinceEpoch}',
      role: 'assistant',
      content: content,
      timestamp: DateTime.now(),
    );
  }

  void _replaceAssistantTurn(
    String sessionId,
    String turnId,
    ChatTurn replacement, {
    AiSession Function(AiSession session)? sessionPatch,
  }) {
    final AiSession? session = state.sessions[sessionId];
    if (session == null) return;
    final List<ChatTurn> messages = List<ChatTurn>.of(session.messages);
    final int index = messages.indexWhere((ChatTurn turn) => turn.id == turnId);
    if (index >= 0) {
      messages[index] = replacement;
    } else {
      messages.add(replacement);
    }
    final AiSession patched = sessionPatch?.call(session) ?? session;
    state = state.copyWith(
      sessions: <String, AiSession>{
        ...state.sessions,
        sessionId: patched.copyWith(
          messages: messages,
          updatedAt: DateTime.now(),
        ),
      },
    );
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
    codegenSessionId: reply.codegenSessionId,
    confirmedCanonicalDigest: reply.confirmedCanonicalDigest,
  );

  String? _firstNonBlank(Iterable<String?> values) {
    for (final String? value in values) {
      final String trimmed = value?.trim() ?? '';
      if (trimmed.isNotEmpty) return trimmed;
    }
    return null;
  }
}

final aiHomePageControllerProvider =
    NotifierProvider.autoDispose<AiHomePageController, AiHomePageState>(
      AiHomePageController.new,
    );
