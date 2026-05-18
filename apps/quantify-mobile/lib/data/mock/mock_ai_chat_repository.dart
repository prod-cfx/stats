import 'dart:async';

import '../models/ai_chat_models.dart';
import '../repositories/ai_chat_repository.dart';
import 'fixtures/ai_chat.dart';

/// Mock AI 对话 Repository。
///
/// 单例语义：
/// - `_controller` 在常驻 `Provider`（非 `autoDispose`）下生命周期与应用同长，不显式 close
/// - `watchSession(sessionId)` 在 mock 阶段忽略 `sessionId` 始终共享同一 broadcast；
///   真实 API 接入时按 sessionId 路由
/// - 若后续切 `autoDispose` 或测试中 toggle `useMockProvider`，需补 dispose 路径
class MockAiChatRepository implements AiChatRepository {
  final StreamController<ChatTurn> _controller =
      StreamController<ChatTurn>.broadcast();
  int _seq = 0;

  @override
  Future<ChatTurn> sendMessage(ChatTurn turn) async {
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
    return reply;
  }

  @override
  Stream<ChatTurn> watchSession(String sessionId) async* {
    for (final ChatTurn turn in mockChatTurns) {
      yield turn;
    }
    yield* _controller.stream;
  }

  @override
  Future<BacktestSummary?> latestBacktest(String sessionId) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return mockLatestBacktestSummary;
  }
}
