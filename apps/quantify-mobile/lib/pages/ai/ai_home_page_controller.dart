import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/error/error_router.dart';
import '../../core/providers/notifier_lifecycle.dart';
import '../../data/models/ai_chat_models.dart';
import '../../data/models/ai_strategy_context.dart';
import '../../data/models/backtest_models.dart';
import '../../data/models/strategy_models.dart';
import '../../data/providers.dart';
import '../../data/repositories/ai_chat_repository.dart';
import '../../data/repositories/live_strategy_repository.dart';
import '../../data/repositories/strategy_repository.dart';
import '../../data/services/api_client.dart';
import '../../domain/models/live_strategy_models.dart';
import 'ai_home_page_state.dart';

enum AiSessionDeleteBlockReason { runningStrategy, unknownStrategyState }

class AiSessionDeleteBlockedException implements Exception {
  const AiSessionDeleteBlockedException({
    required this.reason,
    required this.strategyId,
    this.strategyName,
  });

  final AiSessionDeleteBlockReason reason;
  final String strategyId;
  final String? strategyName;

  @override
  String toString() =>
      'AiSessionDeleteBlockedException(reason=$reason, strategyId=$strategyId)';
}

/// AI 多会话对话页控制器（issue #2186 三件套迁移）。
///
/// 持有会话集合，经 `ref.read(aiChatRepositoryProvider)` /
/// `strategyRepositoryProvider` 取数。异步回调前以 [NotifierLifecycle]
/// mounted 守卫。
///
/// 边界：导航 / `TextEditingController` / `ScrollController` / drawer pop 等
/// 渲染层副作用留在 widget；本控制器只推进 [AiHomePageState]。
class AiHomePageController extends Notifier<AiHomePageState> {
  static const int _publishPollLimit = 80;
  static const Duration _publishPollInterval = Duration(milliseconds: 1500);

  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  AiChatRepository get _chatRepo => ref.read(aiChatRepositoryProvider);
  LiveStrategyRepository get _liveRepo =>
      ref.read(liveStrategyRepositoryProvider);
  StrategyRepository get _strategyRepo => ref.read(strategyRepositoryProvider);

  @override
  AiHomePageState build() {
    _life.attach(ref);
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
    final String? previousCurrentId = state.currentId;
    final bool hadLoaded = state.initialized;
    state = state.copyWith(loadError: null);
    List<AiSession> list;
    try {
      list = await _chatRepo.listSessions();
    } catch (error) {
      if (!mounted) return;
      if (hadLoaded) {
        state = state.copyWith(
          initialized: true,
          loadError: ErrorRouter.normalize(error).message,
        );
        return;
      }
      state = state.copyWith(
        sessions: const <String, AiSession>{},
        order: const <String>[],
        currentId: null,
        initialized: true,
        loadError: ErrorRouter.normalize(error).message,
      );
      return;
    }
    final List<AiSession> reconciledList = await _reconcileDeployedSessions(
      list,
    );
    if (!mounted) return;
    final Map<String, AiSession> sessions = <String, AiSession>{
      for (final AiSession s in reconciledList) s.id: s,
    };
    final String? nextCurrentId =
        previousCurrentId != null && sessions.containsKey(previousCurrentId)
        ? previousCurrentId
        : (reconciledList.isNotEmpty ? reconciledList.first.id : null);
    state = state.copyWith(
      sessions: sessions,
      order: <String>[for (final AiSession s in reconciledList) s.id],
      currentId: nextCurrentId,
      initialized: true,
      loadError: null,
    );
    await _syncSessionFromRemote(nextCurrentId);
    await _restorePublishedCodegenForCurrentSession();
    await _restoreLatestBacktestForCurrentSession();
  }

  Future<void> syncCurrentSession() async {
    final String? id = state.currentId;
    await _syncSessionFromRemote(id);
    await _restorePublishedCodegenForCurrentSession();
    await _restoreLatestBacktestForCurrentSession();
  }

  Future<void> _syncSessionFromRemote(String? id) async {
    if (id == null) return;
    if (!state.sessions.containsKey(id)) return;
    AiSession detail;
    try {
      detail = await _chatRepo.getSession(id);
      final List<AiSession> reconciled = await _reconcileDeployedSessions(
        <AiSession>[detail],
      );
      detail = reconciled.first;
    } catch (error) {
      if (!mounted) return;
      state = state.copyWith(loadError: ErrorRouter.normalize(error).message);
      return;
    }
    if (!mounted || !state.sessions.containsKey(id)) return;
    state = state.copyWith(
      sessions: <String, AiSession>{...state.sessions, id: detail},
      loadError: null,
    );
  }

  Future<List<AiSession>> _reconcileDeployedSessions(
    List<AiSession> sessions,
  ) async {
    if (sessions.isEmpty) return sessions;
    List<LiveStrategy> strategies;
    try {
      strategies = await _liveRepo.listStrategies();
    } catch (_) {
      return <AiSession>[
        for (final AiSession session in sessions)
          _copySessionWithDeployedTo(session, null),
      ];
    }

    final Map<String, LiveStrategy> bySnapshotId = <String, LiveStrategy>{};
    for (final LiveStrategy strategy in strategies) {
      if (strategy.isHistory) continue;
      final String snapshotId = strategy.publishedSnapshotId?.trim() ?? '';
      if (snapshotId.isEmpty) continue;
      bySnapshotId.putIfAbsent(snapshotId, () => strategy);
    }

    return <AiSession>[
      for (final AiSession session in sessions)
        _copySessionWithDeployedTo(
          session,
          bySnapshotId[_publishedSnapshotIdForSession(session)]?.id,
        ),
    ];
  }

  String? _publishedSnapshotIdForSession(AiSession session) {
    for (final ChatTurn turn in session.messages.reversed) {
      final String snapshotId =
          turn.strategyContext?.publishedSnapshotId?.trim() ?? '';
      if (snapshotId.isNotEmpty) return snapshotId;
    }
    return null;
  }

  AiSession _copySessionWithDeployedTo(AiSession session, String? deployedTo) {
    return AiSession(
      id: session.id,
      title: session.title,
      category: session.category,
      updatedAt: session.updatedAt,
      messages: session.messages,
      pair: session.pair,
      timeframe: session.timeframe,
      cagrLabel: session.cagrLabel,
      deployedTo: deployedTo,
      llmCodegenSessionId: session.llmCodegenSessionId,
      pendingCanonicalDigest: session.pendingCanonicalDigest,
    );
  }

  Future<void> _restoreLatestBacktestForCurrentSession() async {
    final String? id = state.currentId;
    if (id == null) return;
    final AiSession? session = state.sessions[id];
    if (session == null || _latestBacktestSummary(session) != null) return;
    BacktestSummary? summary;
    try {
      summary = await _chatRepo.latestBacktest(id);
    } catch (_) {
      return;
    }
    if (!mounted || summary == null || summary.id.trim().isEmpty) return;
    final AiSession? latest = state.sessions[id];
    if (latest == null || _latestBacktestSummary(latest) != null) return;
    final DateTime now = DateTime.now();
    state = state.copyWith(
      sessions: <String, AiSession>{
        ...state.sessions,
        id: latest.copyWith(
          messages: <ChatTurn>[
            ...latest.messages,
            _backtestResultTurn(summary, now),
          ],
          updatedAt: now,
        ),
      },
    );
  }

  BacktestSummary? _latestBacktestSummary(AiSession session) {
    for (final ChatTurn turn in session.messages.reversed) {
      if (turn.kind == ChatTurnKind.result && turn.backtestSummary != null) {
        return turn.backtestSummary;
      }
    }
    return null;
  }

  Future<void> _restorePublishedCodegenForCurrentSession() async {
    final String? id = state.currentId;
    if (id == null) return;
    final AiSession? session = state.sessions[id];
    if (session == null) return;
    if (_hasScriptReadyTurn(session)) return;
    final String? codegenSessionId = _firstNonBlank(<String?>[
      session.llmCodegenSessionId,
      _latestCodegenSessionId(session),
    ]);
    if (codegenSessionId == null) return;

    CodegenSessionResponseDto result;
    try {
      result = await _chatRepo.getCodegenSession(codegenSessionId);
    } catch (_) {
      return;
    }
    if (!mounted) return;
    if (result.status != CodegenSessionResponseDtoStatusEnum.PUBLISHED) return;
    final AiPublishedStrategyContext strategyContext =
        AiPublishedStrategyContext.fromCodegen(result);
    if (!strategyContext.hasPublishedSnapshot && !strategyContext.hasScript) {
      return;
    }
    final AiSession? latest = state.sessions[id];
    if (latest == null || _hasScriptReadyTurn(latest)) return;
    final DateTime now = DateTime.now();
    final List<ChatTurn> restoredTurns = <ChatTurn>[];
    final ChatTurn? logicTurn = _publishedLogicTurn(result, now);
    if (logicTurn != null && !_hasConfirmParamsTurn(latest, result.id)) {
      restoredTurns.add(logicTurn);
    }
    final ChatTurn restored = _publishedScriptTurn(result);
    state = state.copyWith(
      sessions: <String, AiSession>{
        ...state.sessions,
        id: latest.copyWith(
          messages: <ChatTurn>[...latest.messages, ...restoredTurns, restored],
          updatedAt: now,
          llmCodegenSessionId: result.id,
          pendingCanonicalDigest: result.canonicalDigest,
        ),
      },
    );
  }

  bool _hasScriptReadyTurn(AiSession session) {
    return session.messages.any(
      (ChatTurn turn) => turn.kind == ChatTurnKind.scriptReady,
    );
  }

  bool _hasConfirmParamsTurn(AiSession session, String codegenSessionId) {
    return session.messages.any(
      (ChatTurn turn) =>
          turn.kind == ChatTurnKind.params &&
          _codegenSessionIdForTurn(turn) == codegenSessionId,
    );
  }

  String? _latestCodegenSessionId(AiSession session) {
    for (final ChatTurn turn in session.messages.reversed) {
      final String? codegenSessionId = _codegenSessionIdForTurn(turn);
      if (codegenSessionId != null) return codegenSessionId;
    }
    return null;
  }

  String? _codegenSessionIdForTurn(ChatTurn turn) {
    return _firstNonBlank(<String?>[
      turn.codegenSessionId,
      turn.params?['codegenSessionId'],
      turn.params?['llmCodegenSessionId'],
      turn.params?['activeCodegenSessionId'],
      turn.params?['sessionId'],
    ]);
  }

  /// 切会话；返回是否真正切换（false = 点中当前会话，widget 仅关 drawer）。
  bool switchSession(String id) {
    if (id == state.currentId) return false;
    state = state.copyWith(currentId: id, isThinking: false);
    return true;
  }

  Future<bool> switchSessionAndSync(String id) async {
    final bool switched = switchSession(id);
    await syncCurrentSession();
    return switched;
  }

  Future<void> createSession(String untitledTitle) async {
    final AiSession fresh = await _chatRepo.createSession(title: untitledTitle);
    if (!mounted) return;
    final Map<String, String> drafts = Map<String, String>.of(state.drafts)
      ..remove(fresh.id);
    state = state.copyWith(
      sessions: <String, AiSession>{...state.sessions, fresh.id: fresh},
      order: <String>[fresh.id, ...state.order],
      currentId: fresh.id,
      drafts: drafts,
      isThinking: false,
    );
  }

  Future<void> deleteSession(String id) async {
    await ensureSessionCanBeDeleted(id);
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

  void renameSession(String id, String title) {
    final String nextTitle = title.trim();
    if (nextTitle.isEmpty) return;
    final AiSession? session = state.sessions[id];
    if (session == null || session.title == nextTitle) return;
    final DateTime now = DateTime.now();
    final List<String> order = <String>[
      id,
      for (final String item in state.order)
        if (item != id) item,
    ];
    state = state.copyWith(
      sessions: <String, AiSession>{
        ...state.sessions,
        id: session.copyWith(title: nextTitle, updatedAt: now),
      },
      order: order,
    );
  }

  Future<void> ensureSessionCanBeDeleted(String id) async {
    final AiSession? session = state.sessions[id];
    final String strategyId = session?.deployedTo?.trim() ?? '';
    if (strategyId.isEmpty) return;

    LiveStrategy strategy;
    try {
      strategy = await _liveRepo.getStrategy(strategyId);
    } on ApiException catch (error) {
      if (error.statusCode == 404 ||
          error.code == 'ACCOUNT_STRATEGY_NOT_FOUND') {
        return;
      }
      throw AiSessionDeleteBlockedException(
        reason: AiSessionDeleteBlockReason.unknownStrategyState,
        strategyId: strategyId,
      );
    } catch (_) {
      throw AiSessionDeleteBlockedException(
        reason: AiSessionDeleteBlockReason.unknownStrategyState,
        strategyId: strategyId,
      );
    }

    if (strategy.status == LiveStrategyStatus.running ||
        strategy.status == LiveStrategyStatus.warning) {
      throw AiSessionDeleteBlockedException(
        reason: AiSessionDeleteBlockReason.runningStrategy,
        strategyId: strategy.id,
        strategyName: strategy.name,
      );
    }
  }

  /// 发送一条消息：追加 user turn → thinking → 取完整 reply → 立即显示。
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
    // 部分 mock 会把 reply 同步追加到对应 session；剥掉同 id 尾项后
    // 统一由 controller 追加完整回复，避免重复显示。
    final List<ChatTurn> base = List<ChatTurn>.of(cur2.messages);
    if (base.isNotEmpty && base.last.id == reply.id) base.removeLast();
    state = state.copyWith(
      sessions: <String, AiSession>{
        ...state.sessions,
        id: cur2.copyWith(
          messages: <ChatTurn>[...base, _replyWith(reply, reply.content)],
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
    );
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
      content: '正在生成策略脚本',
      timestamp: now.add(const Duration(milliseconds: 1)),
      kind: ChatTurnKind.scriptGenerating,
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

  Future<void> consumeConfirmHandoff(
    CodegenSessionResponseDto result, {
    required String newSessionTitleFallback,
  }) async {
    if (!state.initialized) return;

    String? targetId = state.currentId;
    if (targetId == null || state.sessions[targetId] == null) {
      final AiSession fresh = await _chatRepo.createSession(
        title: newSessionTitleFallback,
      );
      if (!mounted) return;
      state = state.copyWith(
        sessions: <String, AiSession>{...state.sessions, fresh.id: fresh},
        order: <String>[fresh.id, ...state.order],
        currentId: fresh.id,
      );
      targetId = fresh.id;
    }

    final AiSession? session = state.sessions[targetId];
    if (session == null) return;
    final String turnSeed = result.id.trim().isNotEmpty == true
        ? result.id.trim()
        : 'handoff';
    final bool alreadyReady = session.messages.any(
      (ChatTurn turn) =>
          turn.kind == ChatTurnKind.scriptReady &&
          turn.strategyContext?.publishedSnapshotId ==
              result.publishedSnapshotId,
    );
    if (alreadyReady) return;

    final DateTime now = DateTime.now();
    final ChatTurn pendingTurn = ChatTurn(
      id: 'confirm-handoff-pending-$turnSeed-${now.microsecondsSinceEpoch}',
      role: 'assistant',
      content: '正在生成策略脚本',
      timestamp: now,
      kind: ChatTurnKind.scriptGenerating,
      codegenSessionId: result.id,
      confirmedCanonicalDigest: result.canonicalDigest,
    );
    state = state.copyWith(
      sessions: <String, AiSession>{
        ...state.sessions,
        targetId: session.copyWith(
          messages: <ChatTurn>[...session.messages, pendingTurn],
          updatedAt: now,
          llmCodegenSessionId: result.id,
          pendingCanonicalDigest: result.canonicalDigest,
        ),
      },
      isThinking: true,
    );

    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (!mounted) return;
    _replaceAssistantTurn(
      targetId,
      pendingTurn.id,
      _publishedScriptTurn(result),
      sessionPatch: (AiSession s) => s.copyWith(
        llmCodegenSessionId: result.id,
        pendingCanonicalDigest: result.canonicalDigest,
      ),
    );
    if (mounted) state = state.copyWith(isThinking: false);
  }

  Future<void> consumeBacktestHandoff(
    BacktestResult result, {
    AiPublishedStrategyContext? strategyContext,
    String? sessionId,
    required String newSessionTitleFallback,
  }) async {
    if (!state.initialized) return;
    final String? preferredId = _firstNonBlank(<String?>[
      sessionId,
      state.currentId,
    ]);

    String? targetId = preferredId;
    if (targetId == null || state.sessions[targetId] == null) {
      final AiSession fresh = await _chatRepo.createSession(
        title: newSessionTitleFallback,
      );
      if (!mounted) return;
      state = state.copyWith(
        sessions: <String, AiSession>{...state.sessions, fresh.id: fresh},
        order: <String>[fresh.id, ...state.order],
        currentId: fresh.id,
      );
      targetId = fresh.id;
    }

    final AiSession? session = state.sessions[targetId];
    if (session == null) return;
    final String jobId = result.id.trim();
    if (jobId.isEmpty) return;
    final bool alreadyAdded = session.messages.any(
      (ChatTurn turn) =>
          turn.kind == ChatTurnKind.result && turn.backtestSummary?.id == jobId,
    );
    if (alreadyAdded) {
      state = state.copyWith(currentId: targetId);
      return;
    }

    final BacktestSummary summary = BacktestSummary(
      id: jobId,
      totalReturnPercent: result.closedReturnPercent,
      maxDrawdownPercent: result.maxDrawdownPercent,
      trades: result.closedTrades,
    );
    final DateTime now = DateTime.now();
    final ChatTurn resultTurn = _backtestResultTurn(
      summary,
      now,
      strategyContext: strategyContext,
    );
    state = state.copyWith(
      currentId: targetId,
      sessions: <String, AiSession>{
        ...state.sessions,
        targetId: session.copyWith(
          messages: <ChatTurn>[...session.messages, resultTurn],
          updatedAt: now,
        ),
      },
    );
  }

  ChatTurn _backtestResultTurn(
    BacktestSummary summary,
    DateTime timestamp, {
    AiPublishedStrategyContext? strategyContext,
  }) {
    return ChatTurn(
      id: 'backtest-result-${summary.id}-${timestamp.microsecondsSinceEpoch}',
      role: 'assistant',
      content:
          '回测完成，可在下方「回测结果」查看完整曲线和指标。已平仓收益 ${summary.totalReturnPercent >= 0 ? '+' : ''}${summary.totalReturnPercent.toStringAsFixed(1)}%，最大回撤 -${summary.maxDrawdownPercent.abs().toStringAsFixed(1)}%。',
      timestamp: timestamp,
      kind: ChatTurnKind.result,
      strategyContext: strategyContext,
      backtestSummary: summary,
    );
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
    final AiPublishedStrategyContext strategyContext =
        AiPublishedStrategyContext.fromCodegen(result);
    return ChatTurn(
      id: 'published-script-${result.id}-${DateTime.now().microsecondsSinceEpoch}',
      role: 'assistant',
      content: '策略脚本已生成',
      timestamp: DateTime.now(),
      kind: ChatTurnKind.scriptReady,
      codegenSessionId: result.id,
      confirmedCanonicalDigest: result.canonicalDigest,
      strategyContext: strategyContext,
    );
  }

  ChatTurn? _publishedLogicTurn(
    CodegenSessionResponseDto result,
    DateTime timestamp,
  ) {
    final Map<String, String> params = _stringParamsFromCodegen(result);
    if (params.isEmpty) return null;
    return ChatTurn(
      id: 'published-logic-${result.id}-${timestamp.microsecondsSinceEpoch}',
      role: 'assistant',
      content: result.assistantPrompt?.trim().isNotEmpty == true
          ? result.assistantPrompt!.trim()
          : '策略逻辑已生成，请确认后继续生成脚本。',
      timestamp: timestamp,
      kind: ChatTurnKind.params,
      params: params,
      codegenSessionId: result.id,
      confirmedCanonicalDigest: result.canonicalDigest,
    );
  }

  Map<String, String> _stringParamsFromCodegen(
    CodegenSessionResponseDto result,
  ) {
    final Map<String, String> params = <String, String>{};
    void collect(dynamic source) {
      if (source == null) return;
      for (final dynamic entry in source.entries) {
        final String key = entry.key.toString();
        final Object? raw = entry.value?.value;
        final String value = raw?.toString().trim() ?? '';
        if (key.trim().isNotEmpty && value.isNotEmpty && value != 'null') {
          params[key] = value;
        }
      }
    }

    collect(result.publishedSnapshotParamValues);
    if (params.isEmpty) collect(result.specDesc);
    return params;
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
    strategyContext: reply.strategyContext,
    backtestSummary: reply.backtestSummary,
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
