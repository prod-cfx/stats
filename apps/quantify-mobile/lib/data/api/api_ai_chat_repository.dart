import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';

import '../models/ai_chat_models.dart';
import '../models/ai_strategy_context.dart';
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
      pick(m, <String>[
        'codegenSessionId',
        'llmCodegenSessionId',
        'activeCodegenSessionId',
        'sessionId',
      ]),
    ),
    confirmedCanonicalDigest: asStringOrNull(
      pick(m, <String>['confirmedCanonicalDigest', 'canonicalDigest']),
    ),
  );
}

AiSession _parseSession(Map<String, dynamic> m) {
  final List<ChatTurn> messages = asMapList(
    pick(m, <String>['messages', 'conversationMessages']),
  ).map(_parseTurn).toList(growable: true);
  final DateTime updatedAt = asDateTime(pick(m, <String>['updatedAt']));
  final ChatTurn? scriptReadyTurn = _scriptReadyTurnFromConversation(
    m,
    timestamp: updatedAt,
  );
  if (scriptReadyTurn != null &&
      !messages.any((ChatTurn turn) => turn.kind == ChatTurnKind.scriptReady)) {
    messages.add(scriptReadyTurn);
  }
  final ChatTurn? backtestTurn = _backtestResultTurnFromConversation(
    m,
    timestamp: updatedAt,
  );
  if (backtestTurn != null &&
      !messages.any(
        (ChatTurn turn) =>
            turn.kind == ChatTurnKind.result &&
            turn.backtestSummary?.id == backtestTurn.backtestSummary?.id,
      )) {
    messages.add(backtestTurn);
  }

  return AiSession(
    id: asString(pick(m, <String>['id'])),
    title: asString(pick(m, <String>['title', 'conversationTitle'])),
    category: asString(pick(m, <String>['category']), fallback: '未分类'),
    updatedAt: updatedAt,
    messages: messages.toList(growable: false),
    pair: asStringOrNull(pick(m, <String>['pair'])),
    timeframe: asStringOrNull(pick(m, <String>['timeframe'])),
    cagrLabel: asStringOrNull(pick(m, <String>['cagrLabel'])),
    deployedTo: asStringOrNull(pick(m, <String>['deployedTo'])),
    llmCodegenSessionId: asStringOrNull(
      pick(m, <String>[
        'llmCodegenSessionId',
        'activeCodegenSessionId',
        'codegenSessionId',
        'sessionId',
      ]),
    ),
    pendingCanonicalDigest: asStringOrNull(
      pick(m, <String>['pendingCanonicalDigest', 'canonicalDigest']),
    ),
  );
}

ChatTurn? _scriptReadyTurnFromConversation(
  Map<String, dynamic> m, {
  required DateTime timestamp,
}) {
  final String scriptCode = asString(pick(m, <String>['scriptCode'])).trim();
  final String snapshotId = asString(
    pick(m, <String>['publishedSnapshotId']),
  ).trim();
  if (scriptCode.isEmpty || snapshotId.isEmpty) return null;
  CodegenSessionResponseDto response;
  try {
    response = _codegenSessionFromConversation(m);
  } catch (_) {
    return null;
  }
  final AiPublishedStrategyContext strategyContext =
      AiPublishedStrategyContext.fromCodegen(response);
  return ChatTurn(
    id: 'published-script-${response.id}',
    role: 'assistant',
    content: '策略脚本已生成',
    timestamp: timestamp,
    kind: ChatTurnKind.scriptReady,
    codegenSessionId: response.id,
    confirmedCanonicalDigest: response.canonicalDigest,
    strategyContext: strategyContext,
  );
}

CodegenSessionResponseDto _codegenSessionFromConversation(
  Map<String, dynamic> m,
) {
  final Map<String, dynamic> raw = Map<String, dynamic>.of(m);
  final String activeCodegenSessionId = asString(
    pick(raw, <String>[
      'activeCodegenSessionId',
      'llmCodegenSessionId',
      'codegenSessionId',
      'sessionId',
    ]),
  ).trim();
  if (activeCodegenSessionId.isNotEmpty) raw['id'] = activeCodegenSessionId;
  raw['conversationId'] = asString(pick(m, <String>['id'])).trim();
  final String status = asString(raw['status']).trim();
  if (status.isEmpty &&
      asString(raw['scriptCode']).trim().isNotEmpty &&
      asString(raw['publishedSnapshotId']).trim().isNotEmpty) {
    raw['status'] = 'PUBLISHED';
  }
  return _codegenSessionFromRaw(raw);
}

ChatTurn? _backtestResultTurnFromConversation(
  Map<String, dynamic> m, {
  required DateTime timestamp,
}) {
  final Map<String, dynamic> ref = asMap(m['lastBacktestRef']);
  final BacktestSummary? summary = _backtestSummaryFromRef(ref);
  if (summary == null) return null;
  final DateTime completedAt = asDateTime(
    pick(ref, <String>['completedAt']),
    fallback: timestamp,
  );
  return ChatTurn(
    id: 'backtest-result-${summary.id}',
    role: 'assistant',
    content:
        '回测完成，可在下方「回测结果」查看完整曲线和指标。已平仓收益 ${summary.totalReturnPercent >= 0 ? '+' : ''}${summary.totalReturnPercent.toStringAsFixed(1)}%，最大回撤 -${summary.maxDrawdownPercent.abs().toStringAsFixed(1)}%。',
    timestamp: completedAt,
    kind: ChatTurnKind.result,
    backtestSummary: summary,
  );
}

BacktestSummary? _backtestSummaryFromRef(Map<String, dynamic> ref) {
  final String jobId = asString(pick(ref, <String>['jobId', 'id'])).trim();
  final Map<String, dynamic> summary = asMap(ref['summary']);
  if (jobId.isEmpty || summary.isEmpty) return null;
  return BacktestSummary(
    id: jobId,
    totalReturnPercent: asDouble(
      pick(summary, <String>['totalReturnPct', 'totalReturnPercent']),
    ),
    maxDrawdownPercent: asDouble(
      pick(summary, <String>['maxDrawdownPct', 'maxDrawdownPercent']),
    ),
    trades: asInt(pick(summary, <String>['tradeCount', 'trades'])),
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

String? _canonicalDigestFromSpec(BuiltMap<String, JsonObject?>? specDesc) {
  final Map<String, dynamic> spec = _builtJsonMap(specDesc);
  final String direct = asString(spec['canonicalDigest']).trim();
  if (direct.isNotEmpty) return direct;
  final String nested = asString(
    pick(asMap(spec['confirmation']), <String>['digest']),
  ).trim();
  return nested.isEmpty ? null : nested;
}

String? _pendingCanonicalDigest(CodegenSessionResponseDto response) {
  final Map<String, dynamic> gate = _builtJsonMap(response.clarificationGate);
  if (gate['blocked'] == true) return null;
  final String direct = response.canonicalDigest?.trim() ?? '';
  if (direct.isNotEmpty) return direct;
  return _canonicalDigestFromSpec(response.specDesc);
}

Map<String, String> _stringParamsFromBuilt(
  BuiltMap<String, JsonObject?>? source,
) {
  return _builtJsonMap(source).map(
    (String key, dynamic value) =>
        MapEntry<String, String>(key, asString(value)),
  )..removeWhere((String _, String value) => value.isEmpty);
}

BuiltMap<String, JsonObject?>? _builtJsonObjectMap(
  Map<String, Object?>? source,
) {
  if (source == null || source.isEmpty) return null;
  return BuiltMap<String, JsonObject?>(
    source.map(
      (String key, Object? value) =>
          MapEntry<String, JsonObject?>(key, JsonObject(value)),
    ),
  );
}

Map<String, dynamic> _unwrapObjectEnvelope(Object? raw) {
  final Map<String, dynamic> map = asMap(raw);
  final Object? data = map['data'];
  if (data is Map) return asMap(data);
  return map;
}

BuiltMap<String, JsonObject?>? _jsonObjectMapFromRaw(Object? raw) {
  final Map<String, dynamic> map = asMap(raw);
  if (map.isEmpty) return null;
  final Map<String, JsonObject?> sanitized = <String, JsonObject?>{};
  for (final MapEntry<String, dynamic> entry in map.entries) {
    final Object? value = _jsonObjectValueOrNull(entry.value);
    if (value != null) sanitized[entry.key] = JsonObject(value);
  }
  if (sanitized.isEmpty) return null;
  return BuiltMap<String, JsonObject?>(sanitized);
}

Object? _jsonObjectValueOrNull(Object? raw) {
  if (raw == null) return null;
  if (raw is String || raw is num || raw is bool) return raw;
  if (raw is List) {
    return raw
        .map(_jsonObjectValueOrNull)
        .where((Object? value) => value != null)
        .toList(growable: false);
  }
  if (raw is Map) {
    final Map<String, Object?> map = <String, Object?>{};
    for (final MapEntry<Object?, Object?> entry in raw.entries) {
      final Object? value = _jsonObjectValueOrNull(entry.value);
      if (value != null) map['${entry.key}'] = value;
    }
    return map;
  }
  return raw.toString();
}

String? _optionalStringFromRaw(Object? raw) {
  if (raw == null) return null;
  final String value = asString(raw).trim();
  return value.isEmpty || value.toLowerCase() == 'null' ? null : value;
}

void _setOptionalString(void Function(String value) set, Object? raw) {
  final String? value = _optionalStringFromRaw(raw);
  if (value != null) set(value);
}

void _replaceOptionalMap(
  void Function(BuiltMap<String, JsonObject?> value) replace,
  BuiltMap<String, JsonObject?>? value,
) {
  if (value != null) replace(value);
}

BuiltMap<String, JsonObject?> _emptyJsonObjectMap() =>
    BuiltMap<String, JsonObject?>(const <String, JsonObject?>{});

void _populateCodegenSessionBuilder(
  CodegenSessionResponseDtoBuilder b,
  Map<String, dynamic> map,
) {
  b
    ..id = asString(pick(map, <String>['id'])).trim()
    ..status = _codegenStatusFromRaw(map['status'])
    ..clarificationGate.replace(
      _jsonObjectMapFromRaw(map['clarificationGate']) ?? _emptyJsonObjectMap(),
    );
  _setOptionalString((String v) => b.conversationId = v, map['conversationId']);
  _setOptionalString(
    (String v) => b.conversationTitle = v,
    map['conversationTitle'],
  );
  _setOptionalString((String v) => b.scriptCode = v, map['scriptCode']);
  _setOptionalString(
    (String v) => b.publishedSnapshotId = v,
    map['publishedSnapshotId'],
  );
  _setOptionalString(
    (String v) => b.canonicalDigest = v,
    map['canonicalDigest'],
  );
  _setOptionalString(
    (String v) => b.strategyInstanceId = v,
    map['strategyInstanceId'],
  );
  _setOptionalString((String v) => b.rejectReason = v, map['rejectReason']);
  _setOptionalString(
    (String v) => b.assistantPrompt = v,
    map['assistantPrompt'],
  );
  _replaceOptionalMap(
    b.publishedSnapshotParamValues.replace,
    _jsonObjectMapFromRaw(map['publishedSnapshotParamValues']),
  );
  _replaceOptionalMap(
    b.publishedSnapshotStrategyConfig.replace,
    _jsonObjectMapFromRaw(map['publishedSnapshotStrategyConfig']),
  );
  _replaceOptionalMap(
    b.publishedSnapshotBacktestConfigDefaults.replace,
    _jsonObjectMapFromRaw(map['publishedSnapshotBacktestConfigDefaults']),
  );
  _replaceOptionalMap(
    b.publishedSnapshotDeploymentExecutionDefaults.replace,
    _jsonObjectMapFromRaw(map['publishedSnapshotDeploymentExecutionDefaults']),
  );
  _replaceOptionalMap(
    b.publishedSnapshotDeploymentExecutionConstraints.replace,
    _jsonObjectMapFromRaw(
      map['publishedSnapshotDeploymentExecutionConstraints'],
    ),
  );
  _replaceOptionalMap(
    b.publishedSnapshotCompatibilityMetadata.replace,
    _jsonObjectMapFromRaw(map['publishedSnapshotCompatibilityMetadata']),
  );
  _replaceOptionalMap(
    b.specDesc.replace,
    _jsonObjectMapFromRaw(map['specDesc']),
  );
  _replaceOptionalMap(
    b.semanticGraph.replace,
    _jsonObjectMapFromRaw(map['semanticGraph']),
  );
  _replaceOptionalMap(
    b.validationReport.replace,
    _jsonObjectMapFromRaw(map['validationReport']),
  );
  _replaceOptionalMap(
    b.clarificationState.replace,
    _jsonObjectMapFromRaw(map['clarificationState']),
  );
  _replaceOptionalMap(
    b.publicationGate.replace,
    _jsonObjectMapFromRaw(map['publicationGate']),
  );
}

CodegenSessionResponseDtoStatusEnum _codegenStatusFromRaw(Object? raw) {
  final String status = asString(raw).trim().toUpperCase();
  if (status.isEmpty) {
    throw const ApiException(message: '策略生成会话状态缺失，请返回 AI 对话重新确认。');
  }
  try {
    return CodegenSessionResponseDtoStatusEnum.valueOf(status);
  } catch (_) {
    throw ApiException(message: '策略生成会话状态异常：$status');
  }
}

CodegenSessionResponseDto _codegenSessionFromRaw(Object? raw) {
  final Map<String, dynamic> map = _unwrapObjectEnvelope(raw);
  final String id = asString(pick(map, <String>['id'])).trim();
  if (id.isEmpty) {
    throw const ApiException(message: '策略生成会话暂不可用，请返回 AI 对话重新发送策略。');
  }
  return CodegenSessionResponseDto(
    (CodegenSessionResponseDtoBuilder b) =>
        _populateCodegenSessionBuilder(b, map),
  );
}

AiSession _sessionFromStrategyDetail(
  AccountAiQuantStrategyDetailResponseDto dto,
) {
  return AiSession(
    id: dto.id,
    title: dto.name,
    category: 'AI 量化',
    updatedAt: asDateTime(dto.updatedAt),
    messages: const <ChatTurn>[],
    pair: dto.symbol,
    timeframe: dto.timeframe,
    deployedTo: dto.id,
  );
}

ChatTurn _turnFromCodegen(CodegenSessionResponseDto response) {
  final bool isConfirmGate =
      response.status == CodegenSessionResponseDtoStatusEnum.CONFIRM_GATE;
  final Map<String, String> params = isConfirmGate
      ? const <String, String>{}
      : _stringParamsFromBuilt(
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
    confirmedCanonicalDigest: _pendingCanonicalDigest(response),
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
    pendingCanonicalDigest: _pendingCanonicalDigest(response),
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
    Duration deployPollInterval = const Duration(seconds: 2),
  }) : _generatedApi = generatedApi,
       _tokenSupplier = tokenSupplier,
       _sessionPollInterval = sessionPollInterval,
       _deployPollInterval = deployPollInterval;

  final AiChatService _service;
  final GeneratedBackendApi? _generatedApi;
  final String Function()? _tokenSupplier;
  final Duration _sessionPollInterval;
  final Duration _deployPollInterval;
  final Map<String, String> _localCodegenSessionIds = <String, String>{};

  AccountAiQuantApi? get _accountAiQuantApi =>
      _generatedApi?.client.getAccountAiQuantApi();

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
      final String id =
          'local-codegen-${DateTime.now().microsecondsSinceEpoch}';
      return AiSession(
        id: id,
        title: title?.trim().isNotEmpty == true ? title!.trim() : '新对话',
        category: 'AI 量化',
        updatedAt: DateTime.now(),
        messages: const <ChatTurn>[],
      );
    }
    return _sessionFromCodegen(
      _codegenSessionFromRaw(await _service.createSession(title: title)),
    );
  }

  @override
  Future<void> deleteSession(String sessionId) async {
    if (sessionId.startsWith('local-codegen-')) {
      _localCodegenSessionIds.remove(sessionId);
      return;
    }
    await _service.deleteSession(sessionId);
  }

  @override
  Future<ChatTurn> sendMessageTo(String sessionId, ChatTurn turn) async {
    final LlmStrategyCodegenApi? api = _codegenApi;
    if (api != null) {
      final bool isLocalSession = sessionId.startsWith('local-codegen-');
      final String? mappedSessionId = _localCodegenSessionIds[sessionId];
      if (isLocalSession && mappedSessionId == null) {
        final response = await api.llmStrategyCodegenControllerStartSession(
          authorization: _authorization(),
          extra: const <String, dynamic>{'unwrapData': true},
          llmCodegenStartRequestDto: LlmCodegenStartRequestDto(
            (b) => b
              ..initialMessage = turn.content
              ..locale = LlmCodegenStartRequestDtoLocaleEnum.zh,
          ),
        );
        final CodegenSessionResponseDto? data = response.data;
        if (data == null) {
          throw const ApiException(message: '策略生成回复为空，请稍后重试。');
        }
        _localCodegenSessionIds[sessionId] = data.id;
        return _turnFromCodegen(data);
      }
      final String remoteSessionId = mappedSessionId ?? sessionId;
      final BuiltMap<String, String>? clarificationAnswers =
          await _clarificationAnswersFor(remoteSessionId, turn.content);
      final response = await api.llmStrategyCodegenControllerContinueSession(
        authorization: _authorization(),
        id: remoteSessionId,
        extra: const <String, dynamic>{'unwrapData': true},
        llmCodegenContinueRequestDto: LlmCodegenContinueRequestDto((b) {
          b
            ..message = turn.content
            ..locale = LlmCodegenContinueRequestDtoLocaleEnum.zh
            ..confirmGenerate = false;
          if (clarificationAnswers != null) {
            b.clarificationAnswers.replace(clarificationAnswers);
          }
        }),
      );
      final CodegenSessionResponseDto? data = response.data;
      if (data == null) {
        throw const ApiException(message: '策略生成回复为空，请稍后重试。');
      }
      return _turnFromCodegen(data);
    }
    return _turnFromCodegen(
      _codegenSessionFromRaw(
        await _service.sendMessage(sessionId, <String, dynamic>{
          'message': turn.content,
          'locale': 'zh',
          'confirmGenerate': false,
        }),
      ),
    );
  }

  @override
  Future<CodegenSessionResponseDto> getCodegenSession(String sessionId) async {
    final String id = _localCodegenSessionIds[sessionId] ?? sessionId;
    final LlmStrategyCodegenApi? api = _codegenApi;
    if (api != null) {
      final response = await api.llmStrategyCodegenControllerGetSession(
        authorization: _authorization(),
        id: id,
        extra: const <String, dynamic>{'unwrapData': true},
      );
      final CodegenSessionResponseDto? data = response.data;
      if (data == null) {
        throw const ApiException(message: '策略生成会话暂不可用，请稍后重试。');
      }
      return data;
    }
    return _codegenSessionFromRaw(await _service.getCodegenSession(id));
  }

  @override
  Future<CodegenSessionResponseDto> confirmStrategy(
    String sessionId, {
    required String message,
    String? confirmedCanonicalDigest,
  }) async {
    final String id = _localCodegenSessionIds[sessionId] ?? sessionId;
    final LlmStrategyCodegenApi? api = _codegenApi;
    if (api != null) {
      final response = await api.llmStrategyCodegenControllerContinueSession(
        authorization: _authorization(),
        id: id,
        extra: const <String, dynamic>{'unwrapData': true},
        llmCodegenContinueRequestDto: LlmCodegenContinueRequestDto((b) {
          b
            ..message = message
            ..locale = LlmCodegenContinueRequestDtoLocaleEnum.zh
            ..confirmGenerate = true;
          if (confirmedCanonicalDigest?.trim().isNotEmpty == true) {
            b.confirmedCanonicalDigest = confirmedCanonicalDigest!.trim();
          }
        }),
      );
      final CodegenSessionResponseDto? data = response.data;
      if (data == null) {
        throw const ApiException(message: '策略确认回复为空，请稍后重试。');
      }
      return data;
    }
    return _codegenSessionFromRaw(
      await _service.sendMessage(id, <String, dynamic>{
        'message': message,
        'locale': 'zh',
        'confirmGenerate': true,
        if (confirmedCanonicalDigest?.trim().isNotEmpty == true)
          'confirmedCanonicalDigest': confirmedCanonicalDigest!.trim(),
      }),
    );
  }

  Future<BuiltMap<String, String>?> _clarificationAnswersFor(
    String sessionId,
    String answer,
  ) async {
    final String value = answer.trim();
    if (value.isEmpty) return null;
    CodegenSessionResponseDto current;
    try {
      current = await getCodegenSession(sessionId);
    } catch (_) {
      return null;
    }
    final Map<String, dynamic> gate = _builtJsonMap(current.clarificationGate);
    if (gate['blocked'] != true) return null;
    final String? key = _firstClarificationKey(gate);
    if (key == null) return null;
    return BuiltMap<String, String>(<String, String>{key: value});
  }

  String? _firstClarificationKey(Map<String, dynamic> gate) {
    for (final String listKey in <String>['items', 'pendingItems']) {
      final Object? items = gate[listKey];
      if (items is! Iterable) continue;
      for (final Object? item in items) {
        final String key = asString(pick(asMap(item), <String>['key'])).trim();
        if (key.isNotEmpty) return key;
      }
    }
    return null;
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
  static const int _deployPollLimit = 45;

  String _deployName(String publishedSnapshotId, String? strategyName) {
    final String name = strategyName?.trim() ?? '';
    return name.isNotEmpty ? name : publishedSnapshotId;
  }

  ApiException? _apiExceptionFrom(Object error) {
    if (error is ApiException) return error;
    if (error is DioException) {
      final Object? inner = error.error;
      if (inner is ApiException) return inner;
      return ApiException.fromDio(error);
    }
    return null;
  }

  bool _isTransientDeployError(Object error) {
    final ApiException? apiError = _apiExceptionFrom(error);
    final String code = apiError?.code ?? '';
    final int? status = apiError?.statusCode;
    final String message = (apiError?.message ?? error.toString())
        .toLowerCase();
    if (code == 'SERVICE_TEMPORARILY_UNAVAILABLE' || code == 'API_TIMEOUT') {
      return true;
    }
    if (status == 502 || status == 503 || status == 504) return true;
    return message.contains('timeout') ||
        message.contains('timed out') ||
        message.contains('took longer') ||
        message.contains('receive data') ||
        message.contains('aborted');
  }

  Future<AiSession?> _pollGeneratedDeployResult(
    AccountAiQuantApi api,
    String deployRequestId,
  ) async {
    for (int i = 0; i < _deployPollLimit; i++) {
      if (i > 0 && _deployPollInterval > Duration.zero) {
        await Future<void>.delayed(_deployPollInterval);
      }
      try {
        final deployResult = await api
            .accountAiQuantStrategiesControllerDeployResult(
              authorization: _authorization(),
              deployRequestId: deployRequestId,
            );
        final AccountAiQuantStrategyDetailResponseDto? result =
            deployResult.data?.data;
        if (result != null) return _sessionFromStrategyDetail(result);
      } catch (error) {
        if (!_isTransientDeployError(error)) rethrow;
      }
    }
    return null;
  }

  Future<AiSession?> _pollManualDeployResult(String deployRequestId) async {
    for (int i = 0; i < _deployPollLimit; i++) {
      if (i > 0 && _deployPollInterval > Duration.zero) {
        await Future<void>.delayed(_deployPollInterval);
      }
      try {
        final Map<String, dynamic> envelope = asMap(
          await _service.getDeployResult(deployRequestId),
        );
        // 信封含 data 键：data==null 视为 pending，继续轮询；非空才解析。
        // 无 data 键则回退原 map（仿 ApiAuthRepository 扁平响应回退）。
        final bool hasData = envelope.containsKey('data');
        final Object? data = envelope['data'];
        if (hasData) {
          if (data == null) continue;
          final Map<String, dynamic> result = asMap(data);
          if (result.isNotEmpty) return _parseSession(result);
          continue;
        }
        if (envelope.isNotEmpty) return _parseSession(envelope);
      } catch (error) {
        if (!_isTransientDeployError(error)) rethrow;
      }
    }
    return null;
  }

  @override
  Future<AiSession?> markDeployed(
    String sessionId,
    String publishedSnapshotId, {
    String? strategyName,
    String? exchangeAccountId,
    String? exchangeAccountName,
    Map<String, Object?>? deploymentExecutionConfig,
  }) async {
    final String deployRequestId = '$sessionId-$publishedSnapshotId';
    final String name = _deployName(publishedSnapshotId, strategyName);
    final AccountAiQuantApi? api = _accountAiQuantApi;
    if (api != null) {
      try {
        final response = await api.accountAiQuantStrategiesControllerDeploy(
          authorization: _authorization(),
          accountAiQuantDeployRequestDto: AccountAiQuantDeployRequestDto((b) {
            b
              ..name = name
              ..deployRequestId = deployRequestId
              ..publishedSnapshotId = publishedSnapshotId;
            if (exchangeAccountId?.trim().isNotEmpty == true) {
              b.exchangeAccountId = exchangeAccountId!.trim();
            }
            if (exchangeAccountName?.trim().isNotEmpty == true) {
              b.exchangeAccountName = exchangeAccountName!.trim();
            }
            final BuiltMap<String, JsonObject?>? config = _builtJsonObjectMap(
              deploymentExecutionConfig,
            );
            if (config != null) b.deploymentExecutionConfig.replace(config);
          }),
        );
        final AccountAiQuantStrategyDetailResponseDto? data =
            response.data?.data;
        if (data != null) return _sessionFromStrategyDetail(data);
      } catch (error) {
        if (!_isTransientDeployError(error)) rethrow;
      }
      return _pollGeneratedDeployResult(api, deployRequestId);
    }

    final Map<String, dynamic> body = <String, dynamic>{
      'name': name,
      'deployRequestId': deployRequestId,
      'publishedSnapshotId': publishedSnapshotId,
    };
    if (exchangeAccountId != null) {
      body['exchangeAccountId'] = exchangeAccountId;
    }
    if (exchangeAccountName != null) {
      body['exchangeAccountName'] = exchangeAccountName;
    }
    if (deploymentExecutionConfig != null) {
      body['deploymentExecutionConfig'] = deploymentExecutionConfig;
    }

    try {
      final Map<String, dynamic> deployEnvelope = asMap(
        await _service.deployStrategy(body),
      );
      final bool hasData = deployEnvelope.containsKey('data');
      final Object? data = deployEnvelope['data'];
      if (hasData) {
        final Map<String, dynamic> direct = asMap(data);
        if (direct.isNotEmpty) return _parseSession(direct);
      } else if (deployEnvelope.isNotEmpty) {
        return _parseSession(deployEnvelope);
      }
    } catch (error) {
      if (!_isTransientDeployError(error)) rethrow;
    }
    return _pollManualDeployResult(deployRequestId);
  }
}
