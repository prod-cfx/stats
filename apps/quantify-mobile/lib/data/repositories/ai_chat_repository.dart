import '../models/ai_chat_models.dart';

/// AI 聊天 Repository 接口。
///
/// 多会话模型（#1557）：
/// - `listSessions()` 返回当前所有会话，按 `updatedAt` 倒序
/// - `createSession(title)` 创建空会话并返回（含默认 greeting 消息）
/// - `deleteSession(id)` 删除会话；最后一条会话被删时由调用方决定重建策略
/// - `sendMessageTo(sessionId, turn)` 在指定会话追加一条消息并返回 assistant 回复
/// - `watchSession(id)` 订阅指定会话的消息流（mock 阶段共享广播）
/// - `markDeployed(sessionId, instanceId)` 部署成功后回写会话 `deployedTo`，
///   返回更新后的会话；找不到会话时返回 null
abstract class AiChatRepository {
  Future<List<AiSession>> listSessions();
  Future<AiSession> createSession({String? title});
  Future<void> deleteSession(String sessionId);
  Future<ChatTurn> sendMessageTo(String sessionId, ChatTurn turn);
  Stream<ChatTurn> watchSession(String sessionId);
  Future<BacktestSummary?> latestBacktest(String sessionId);
  Future<AiSession?> markDeployed(String sessionId, String instanceId);
}
