import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';

import '../models/ai_chat_models.dart';
import '../repositories/ai_chat_repository.dart';
import '../services/account_services.dart';
import '../services/api_client.dart';
import '../services/generated_backend_api.dart';
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
    codegenSessionId: asStringOrNull(
      pick(m, <String>['codegenSessionId', 'llmCodegenSessionId', 'sessionId']),
    ),
    confirmedCanonicalDigest: asStringOrNull(
      pick(m, <String>['confirmedCanonicalDigest', 'canonicalDigest']),
    ),
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
    llmCodegenSessionId: asStringOrNull(
      pick(m, <String>['llmCodegenSessionId', 'sessionId']),
    ),
    pendingCanonicalDigest: asStringOrNull(
      pick(m, <String>['pendingCanonicalDigest', 'canonicalDigest']),
    ),
  );
}

dynamic _jsonObjectValue(JsonObject? object) => object?.value;

Map<String, dynamic> _builtJsonMap(BuiltMap<String, JsonObject?>? source) {
  if (source == null) return <String, dynamic>{};
  return Map<String, dynamic>.fromEntries(
    source.entries.map(
      (MapEntry<String, JsonObject?> entry) =>
          MapEntry<String, dynamic>(entry.key, _jsonObjectValue(entry.value)),
    ),
  );
}

Map<String, String> _stringParamsFromBuilt(
  BuiltMap<String, JsonObject?>? source,
) {
  return _builtJsonMap(source).map(
    (String key, dynamic value) =>
        MapEntry<String, String>(key, asString(value)),
  )..removeWhere((String _, String value) => value.isEmpty);
}

ChatTurn _turnFromCodegen(CodegenSessionResponseDto response) {
  final Map<String, String> params = _stringParamsFromBuilt(
    response.publishedSnapshotParamValues ?? response.specDesc,
  );
  final bool hasParams = params.isNotEmpty;
  final String content = response.assistantPrompt?.trim().isNotEmpty == true
      ? response.assistantPrompt!.trim()
      : switch (response.status.name) {
          'PUBLISHED' => '策略已确认并生成脚本。',
          'CONFIRM_GATE' => '策略逻辑已生成，请确认后继续生成脚本。',
          'CONSISTENCY_FAILED' => response.rejectReason ?? '策略一致性校验未通过。',
          'REJECTED' => response.rejectReason ?? '后端拒绝了当前策略生成结果。',
          _ => '策略生成状态：${response.status.name}',
        };

  return ChatTurn(
    id: 'codegen-${response.id}-${DateTime.now().microsecondsSinceEpoch}',
    role: 'assistant',
    content: content,
    timestamp: DateTime.now(),
    kind: hasParams ? ChatTurnKind.params : ChatTurnKind.text,
    params: hasParams ? params : null,
    codegenSessionId: response.id,
    confirmedCanonicalDigest: response.canonicalDigest,
  );
}

AiSession _sessionFromCodegen(CodegenSessionResponseDto response) {
  final ChatTurn turn = _turnFromCodegen(response);
  return AiSession(
    id: response.id,
    title: response.conversationTitle ?? 'AI 策略会话',
    category: 'AI 量化',
    updatedAt: DateTime.now(),
    messages: <ChatTurn>[turn],
    llmCodegenSessionId: response.id,
    pendingCanonicalDigest: response.canonicalDigest,
    deployedTo: response.strategyInstanceId,
  );
}

/// [AiChatRepository] 真实现（issue #2189）。
///
/// 会话 CRUD + 发消息走真实 HTTP + JSON 反序列化。`watchSession` 使用
/// codegen session GET 持续轮询，直到后端进入终态或调用方取消订阅。
class ApiAiChatRepository implements AiChatRepository {
  ApiAiChatRepository(
    this._service, {
    GeneratedBackendApi? generatedApi,
    String Function()? tokenSupplier,
    Duration sessionPollInterval = const Duration(milliseconds: 500),
  }) : _generatedApi = generatedApi,
       _tokenSupplier = tokenSupplier,
       _sessionPollInterval = sessionPollInterval;

  final AiChatService _service;
  final GeneratedBackendApi? _generatedApi;
  final String Function()? _tokenSupplier;
  final Duration _sessionPollInterval;

  LlmStrategyCodegenApi? get _codegenApi =>
      _generatedApi?.client.getLlmStrategyCodegenApi();

  String _authorization() {
    final String token = _tokenSupplier?.call() ?? '';
    if (token.isEmpty) {
      throw const ApiException(message: 'login required', statusCode: 401);
    }
    return 'Bearer $token';
  }

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
    final LlmStrategyCodegenApi? api = _codegenApi;
    if (api != null) {
      final response = await api.llmStrategyCodegenControllerStartSession(
        authorization: _authorization(),
        llmCodegenStartRequestDto: LlmCodegenStartRequestDto(
          (b) => b..locale = LlmCodegenStartRequestDtoLocaleEnum.zh,
        ),
      );
      final CodegenSessionResponseDto? data = response.data;
      if (data != null) return _sessionFromCodegen(data);
    }
    return _parseSession(asMap(await _service.createSession(title: title)));
  }

  @override
  Future<void> deleteSession(String sessionId) =>
      _service.deleteSession(sessionId);

  @override
  Future<ChatTurn> sendMessageTo(String sessionId, ChatTurn turn) async {
    final LlmStrategyCodegenApi? api = _codegenApi;
    if (api != null) {
      final response = await api.llmStrategyCodegenControllerContinueSession(
        authorization: _authorization(),
        id: sessionId,
        llmCodegenContinueRequestDto: LlmCodegenContinueRequestDto(
          (b) => b
            ..message = turn.content
            ..locale = LlmCodegenContinueRequestDtoLocaleEnum.zh
            ..confirmGenerate = false,
        ),
      );
      final CodegenSessionResponseDto? data = response.data;
      if (data != null) return _turnFromCodegen(data);
    }
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
  Future<CodegenSessionResponseDto> getCodegenSession(String sessionId) async {
    final LlmStrategyCodegenApi? api = _codegenApi;
    if (api == null) {
      throw const ApiException(message: 'generated backend API unavailable');
    }
    final response = await api.llmStrategyCodegenControllerGetSession(
      authorization: _authorization(),
      id: sessionId,
    );
    final CodegenSessionResponseDto? data = response.data;
    if (data == null) {
      throw const ApiException(message: 'empty codegen session');
    }
    return data;
  }

  @override
  Future<CodegenSessionResponseDto> confirmStrategy(
    String sessionId, {
    required String message,
    String? confirmedCanonicalDigest,
  }) async {
    final LlmStrategyCodegenApi? api = _codegenApi;
    if (api == null) {
      throw const ApiException(message: 'generated backend API unavailable');
    }
    final response = await api.llmStrategyCodegenControllerContinueSession(
      authorization: _authorization(),
      id: sessionId,
      llmCodegenContinueRequestDto: LlmCodegenContinueRequestDto((b) {
        b
          ..message = message
          ..locale = LlmCodegenContinueRequestDtoLocaleEnum.zh
          ..confirmGenerate = true;
        if (confirmedCanonicalDigest != null &&
            confirmedCanonicalDigest.trim().isNotEmpty) {
          b.confirmedCanonicalDigest = confirmedCanonicalDigest.trim();
        }
      }),
    );
    final CodegenSessionResponseDto? data = response.data;
    if (data == null) {
      throw const ApiException(message: 'empty codegen session');
    }
    return data;
  }

  @override
  Stream<ChatTurn> watchSession(String sessionId) async* {
    final Set<String> emittedAssistantIds = <String>{};
    while (true) {
      final Map<String, dynamic> raw = asMap(
        await _service.getCodegenSession(sessionId),
      );
      final AiSession session = _parseSession(raw);
      if (session.id != sessionId) return;
      for (final ChatTurn turn in session.messages) {
        if (turn.role != 'assistant') continue;
        if (!emittedAssistantIds.add(turn.id)) continue;
        yield turn;
      }
      final String status = asString(pick(raw, <String>['status']));
      if (_isTerminalCodegenStatus(status)) return;
      if (_sessionPollInterval > Duration.zero) {
        await Future<void>.delayed(_sessionPollInterval);
      } else {
        await Future<void>.delayed(Duration.zero);
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
