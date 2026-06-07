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
  final String content = asString(pick(m, <String>['content']));
  return ChatTurn(
    id: asString(
      pick(m, <String>['id']),
      fallback: 'turn-${asString(pick(m, <String>['role']))}-$content',
    ),
    role: asString(pick(m, <String>['role']), fallback: 'assistant'),
    content: content,
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
    title: asString(pick(m, <String>['title', 'conversationTitle'])),
    category: asString(pick(m, <String>['category']), fallback: '未分类'),
    updatedAt: asDateTime(pick(m, <String>['updatedAt'])),
    messages: asMapList(
      pick(m, <String>['messages', 'conversationMessages']),
    ).map(_parseTurn).toList(growable: false),
    pair: asStringOrNull(pick(m, <String>['pair'])),
    timeframe: asStringOrNull(pick(m, <String>['timeframe'])),
    cagrLabel: asStringOrNull(pick(m, <String>['cagrLabel'])),
    deployedTo: asStringOrNull(pick(m, <String>['deployedTo'])),
  );
}

/// [AiChatRepository] 真实现（issue #2189）。
///
/// 会话 CRUD + 发消息走真实 HTTP + JSON 反序列化。`watchSession` 后端暂无
/// 单会话 GET / 流式契约（`/conversations/{id}` 仅 DELETE/PATCH），故从
/// `listSessions`（`GET /conversations`，契约真源）派生目标会话末条消息后
/// 结束（避免假装持续推送，也不误打不存在的 GET 端点）；真实 SSE/WS 接入
/// 属后续 issue。
class ApiAiChatRepository implements AiChatRepository {
  ApiAiChatRepository(this._service);

  final AiChatService _service;
  static const int _sessionPollLimit = 3;

  List<Map<String, dynamic>> _rows(dynamic raw) {
    final Object? list = raw is Map
        ? pick(asMap(raw), <String>['items', 'data'])
        : raw;
    return asMapList(list ?? raw);
  }

  @override
  Future<List<AiSession>> listSessions() async {
    return _rows(
      await _service.listSessions(),
    ).map(_parseSession).toList(growable: false);
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
    try {
      int emitted = 0;
      for (int i = 0; i < _sessionPollLimit; i++) {
        final Map<String, dynamic> raw = asMap(
          await _service.getCodegenSession(sessionId),
        );
        final AiSession session = _parseSession(raw);
        final List<ChatTurn> messages = session.messages;
        for (final ChatTurn turn in messages.skip(emitted)) {
          if (turn.role == 'assistant') yield turn;
        }
        emitted = messages.length;
        final String status = asString(pick(raw, <String>['status']));
        if (_isTerminalCodegenStatus(status)) return;
      }
      return;
    } catch (_) {
      final List<AiSession> sessions = await listSessions();
      for (final AiSession session in sessions) {
        if (session.id == sessionId) {
          if (session.messages.isNotEmpty) yield session.messages.last;
          return;
        }
      }
    }
  }

  bool _isTerminalCodegenStatus(String status) {
    switch (status.toUpperCase()) {
      case 'PUBLISHED':
      case 'CONSISTENCY_FAILED':
      case 'REJECTED':
        return true;
      default:
        return false;
    }
  }

  @override
  Future<BacktestSummary?> latestBacktest(String sessionId) async {
    final List<Map<String, dynamic>> rows = _rows(
      await _service.listSessions(),
    );
    for (final Map<String, dynamic> row in rows) {
      if (asString(pick(row, <String>['id'])) != sessionId) continue;
      final Map<String, dynamic> ref = asMap(row['lastBacktestRef']);
      final Map<String, dynamic> summary = asMap(ref['summary']);
      if (ref.isEmpty || summary.isEmpty) return null;
      return BacktestSummary(
        id: asString(pick(ref, <String>['jobId', 'id'])),
        totalReturnPercent: asDouble(
          pick(summary, <String>['totalReturnPct', 'totalReturnPercent']),
        ),
        maxDrawdownPercent: asDouble(
          pick(summary, <String>['maxDrawdownPct', 'maxDrawdownPercent']),
        ),
        trades: asInt(pick(summary, <String>['tradeCount', 'trades'])),
      );
    }
    return null;
  }

  /// deploy 结果轮询上限（有界，防死循环）。
  static const int _deployPollLimit = 3;

  @override
  Future<AiSession?> markDeployed(
    String sessionId,
    String publishedSnapshotId, {
    String? exchangeAccountId,
    Map<String, Object?>? deploymentExecutionConfig,
  }) async {
    final String deployRequestId = '$sessionId-$publishedSnapshotId';
    final Map<String, dynamic> body = <String, dynamic>{
      'name': publishedSnapshotId,
      'deployRequestId': deployRequestId,
      'publishedSnapshotId': publishedSnapshotId,
    };
    if (exchangeAccountId != null) {
      body['exchangeAccountId'] = exchangeAccountId;
    }
    if (deploymentExecutionConfig != null) {
      body['deploymentExecutionConfig'] = deploymentExecutionConfig;
    }

    await _service.deployStrategy(body);

    for (int i = 0; i < _deployPollLimit; i++) {
      final Map<String, dynamic> envelope = asMap(
        await _service.getDeployResult(deployRequestId),
      );
      // 信封含 data 键：data==null 视为 pending，继续轮询；非空才解析。
      // 无 data 键则回退原 map（仿 ApiAuthRepository 扁平响应回退）。
      final bool hasData = envelope.containsKey('data');
      final Object? data = envelope['data'];
      if (hasData) {
        if (data == null) continue; // pending
        final Map<String, dynamic> result = asMap(data);
        if (result.isNotEmpty) return _parseSession(result);
        continue;
      }
      if (envelope.isNotEmpty) return _parseSession(envelope);
    }
    return null; // 始终 pending：返回 null，不抛、不死循环。
  }
}
