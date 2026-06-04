import '../models/ai_chat_models.dart';
import '../repositories/ai_chat_repository.dart';
import '../services/account_services.dart';
import '../services/json_codec.dart';

ChatTurnKind _kindFromApi(Object? raw) {
  final String s = asString(raw).toLowerCase();
  for (final ChatTurnKind k in ChatTurnKind.values) {
    if (k.name.toLowerCase() == s) return k;
  }
  return ChatTurnKind.text;
}

ChatTurn _parseTurn(Map<String, dynamic> m) {
  final Object? params = pick(m, <String>['params']);
  return ChatTurn(
    id: asString(pick(m, <String>['id'])),
    role: asString(pick(m, <String>['role']), fallback: 'assistant'),
    content: asString(pick(m, <String>['content'])),
    timestamp: asDateTime(pick(m, <String>['timestamp', 'ts'])),
    kind: _kindFromApi(pick(m, <String>['kind'])),
    params: params is Map
        ? asMap(params).map(
            (String k, dynamic v) => MapEntry<String, String>(k, asString(v)),
          )
        : null,
    deployedExchange: asStringOrNull(pick(m, <String>['deployedExchange'])),
    deployedInstanceId: asStringOrNull(pick(m, <String>['deployedInstanceId'])),
  );
}

AiSession _parseSession(Map<String, dynamic> m) {
  return AiSession(
    id: asString(pick(m, <String>['id'])),
    title: asString(pick(m, <String>['title'])),
    category: asString(pick(m, <String>['category']), fallback: '未分类'),
    updatedAt: asDateTime(pick(m, <String>['updatedAt'])),
    messages: asMapList(pick(m, <String>['messages']))
        .map(_parseTurn)
        .toList(growable: false),
    pair: asStringOrNull(pick(m, <String>['pair'])),
    timeframe: asStringOrNull(pick(m, <String>['timeframe'])),
    cagrLabel: asStringOrNull(pick(m, <String>['cagrLabel'])),
    deployedTo: asStringOrNull(pick(m, <String>['deployedTo'])),
  );
}

/// [AiChatRepository] 真实现（issue #2189）。
///
/// 会话 CRUD + 发消息走真实 HTTP + JSON 反序列化。`watchSession` 后端暂无
/// 流式契约，发一帧最新会话末条消息后结束（避免假装持续推送）；真实 SSE/WS
/// 接入属后续 issue。
class ApiAiChatRepository implements AiChatRepository {
  ApiAiChatRepository(this._service);

  final AiChatService _service;

  List<Map<String, dynamic>> _rows(dynamic raw) {
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['items', 'data']) : raw;
    return asMapList(list ?? raw);
  }

  @override
  Future<List<AiSession>> listSessions() async {
    return _rows(await _service.listSessions())
        .map(_parseSession)
        .toList(growable: false);
  }

  @override
  Future<AiSession> createSession({String? title}) async {
    return _parseSession(asMap(await _service.createSession(title: title)));
  }

  @override
  Future<void> deleteSession(String sessionId) =>
      _service.deleteSession(sessionId);

  @override
  Future<ChatTurn> sendMessageTo(String sessionId, ChatTurn turn) async {
    final dynamic raw = await _service.sendMessage(sessionId, <String, dynamic>{
      'id': turn.id,
      'role': turn.role,
      'content': turn.content,
      'kind': turn.kind.name,
      if (turn.params != null) 'params': turn.params,
    });
    return _parseTurn(asMap(raw));
  }

  @override
  Stream<ChatTurn> watchSession(String sessionId) async* {
    final Map<String, dynamic> m = asMap(await _service.getSession(sessionId));
    final AiSession session = _parseSession(m);
    if (session.messages.isNotEmpty) yield session.messages.last;
  }

  @override
  Future<BacktestSummary?> latestBacktest(String sessionId) async {
    final Map<String, dynamic> m =
        asMap(await _service.latestBacktest(sessionId));
    if (m.isEmpty) return null;
    return BacktestSummary(
      id: asString(pick(m, <String>['id'])),
      totalReturnPercent: asDouble(pick(m, <String>['totalReturnPercent'])),
      maxDrawdownPercent: asDouble(pick(m, <String>['maxDrawdownPercent'])),
      trades: asInt(pick(m, <String>['trades'])),
    );
  }

  @override
  Future<AiSession?> markDeployed(String sessionId, String instanceId) async {
    final Map<String, dynamic> m =
        asMap(await _service.markDeployed(sessionId, instanceId));
    if (m.isEmpty) return null;
    return _parseSession(m);
  }
}
