import '../models/ai_chat_models.dart';

/// AI 聊天 Repository 接口。
abstract class AiChatRepository {
  Future<ChatTurn> sendMessage(ChatTurn turn);
  Stream<ChatTurn> watchSession(String sessionId);
  Future<BacktestSummary?> latestBacktest(String sessionId);
}
