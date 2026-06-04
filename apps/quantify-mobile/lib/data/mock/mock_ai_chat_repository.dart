import 'dart:async';

import '../models/ai_chat_models.dart';
import '../repositories/ai_chat_repository.dart';
import 'fixtures/ai_chat.dart';

/// Mock AI 对话 Repository — 多会话内存实现（#1557）。
///
/// 单例语义：
/// - `_controller` 在常驻 `Provider`（非 `autoDispose`）下生命周期与应用同长，不显式 close
/// - `_sessions` 在进程生命周期内累积；切到真实 API 时由 `ApiAiChatRepository` 接管
/// - `sendMessageTo` 模拟一段 200ms 网络延迟，返回 assistant 回复并同步追加到对应 session
class MockAiChatRepository implements AiChatRepository {
  MockAiChatRepository() : _sessions = buildMockSessions();

  final List<AiSession> _sessions;
  final StreamController<ChatTurn> _controller =
      StreamController<ChatTurn>.broadcast();
  int _seq = 0;

  @override
  Future<List<AiSession>> listSessions() async {
    await Future<void>.delayed(const Duration(milliseconds: 50));
    // 按 updatedAt 倒序返回；不暴露内部列表引用。
    final List<AiSession> sorted = List<AiSession>.of(_sessions)
      ..sort((AiSession a, AiSession b) => b.updatedAt.compareTo(a.updatedAt));
    return sorted;
  }

  @override
  Future<AiSession> createSession({String? title}) async {
    await Future<void>.delayed(const Duration(milliseconds: 50));
    final DateTime now = DateTime.now();
    final AiSession fresh = AiSession(
      id: 's-${now.microsecondsSinceEpoch}',
      title: title?.trim().isNotEmpty == true ? title!.trim() : '新方案',
      category: '未分类',
      updatedAt: now,
      messages: <ChatTurn>[
        ChatTurn(
          id: 'greet-${now.microsecondsSinceEpoch}',
          role: 'assistant',
          content: mockGreeting,
          timestamp: now,
        ),
      ],
    );
    _sessions.insert(0, fresh);
    return fresh;
  }

  @override
  Future<void> deleteSession(String sessionId) async {
    await Future<void>.delayed(const Duration(milliseconds: 50));
    _sessions.removeWhere((AiSession s) => s.id == sessionId);
  }

  @override
  Future<ChatTurn> sendMessageTo(String sessionId, ChatTurn turn) async {
    // 200ms「思考」延迟，给 typing indicator 留显示窗口。
    await Future<void>.delayed(const Duration(milliseconds: 200));
    _controller.add(turn);
    _seq++;
    final ChatTurn reply = ChatTurn(
      id: 'assistant-$_seq',
      role: 'assistant',
      content: '已收到："${turn.content}"。这是一段 mock 回复。',
      timestamp: DateTime.fromMillisecondsSinceEpoch(
        1_716_000_000_000 + _seq * 1000,
      ),
    );
    _controller.add(reply);
    // 把 user turn + reply 同步追加到对应 session，并刷新 updatedAt。
    final int idx = _sessions.indexWhere((AiSession s) => s.id == sessionId);
    if (idx >= 0) {
      final AiSession s = _sessions[idx];
      _sessions[idx] = s.copyWith(
        updatedAt: DateTime.now(),
        messages: <ChatTurn>[...s.messages, turn, reply],
      );
    }
    return reply;
  }

  @override
  Stream<ChatTurn> watchSession(String sessionId) async* {
    // mock 阶段：直接吐当前 session 历史；未来按 sessionId 路由。
    final int idx = _sessions.indexWhere((AiSession s) => s.id == sessionId);
    if (idx >= 0) {
      for (final ChatTurn t in _sessions[idx].messages) {
        yield t;
      }
    }
    yield* _controller.stream;
  }

  @override
  Future<BacktestSummary?> latestBacktest(String sessionId) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return mockLatestBacktestSummary;
  }

  @override
  Future<AiSession?> markDeployed(String sessionId, String instanceId) async {
    await Future<void>.delayed(const Duration(milliseconds: 50));
    final int idx = _sessions.indexWhere((AiSession s) => s.id == sessionId);
    if (idx < 0) return null;
    final DateTime now = DateTime.now();
    final AiSession current = _sessions[idx];
    final bool hasDeployedTurn = current.messages.any(
      (ChatTurn turn) =>
          turn.kind == ChatTurnKind.deployed &&
          turn.deployedInstanceId == instanceId,
    );
    final List<ChatTurn> messages = hasDeployedTurn
        ? current.messages
        : <ChatTurn>[
            ...current.messages,
            ChatTurn(
              id: 'deploy-${now.microsecondsSinceEpoch}',
              role: 'assistant',
              content: '策略已部署到 Binance',
              timestamp: now,
              kind: ChatTurnKind.deployed,
              deployedExchange: 'Binance',
              deployedInstanceId: instanceId,
            ),
          ];
    final AiSession updated = _sessions[idx].copyWith(
      deployedTo: instanceId,
      updatedAt: now,
      messages: messages,
    );
    _sessions[idx] = updated;
    return updated;
  }
}
