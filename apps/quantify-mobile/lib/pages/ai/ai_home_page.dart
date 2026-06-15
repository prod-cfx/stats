import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/ai_chat_models.dart';
import '../../data/models/ai_strategy_context.dart';
import '../../data/models/backtest_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import 'widgets/qz_ai_session_drawer.dart';
import '../../widgets/qz_ai_top_bar.dart';
import 'widgets/qz_chat_bubble.dart';
import '../../widgets/qz_quick_reply_chips.dart';
import '../../widgets/qz_typing_indicator.dart';
import 'ai_backtest_chat_handoff.dart';
import 'ai_confirm_chat_handoff.dart';
import 'ai_home_page_controller.dart';
import 'ai_home_page_state.dart';

/// AI 多会话对话页 — `/ai` tab 根（#1557）。
///
/// 与 #1508 原版的差异：
/// - 会话状态从单一 `_messages` 改为 `Map<String, AiSession>` + currentId
/// - 左侧 Drawer 用 `QzAiSessionDrawer` 列出 / 新建 / 删除会话
/// - 顶栏中部渲染当前会话标题 + 分类副标题
/// - 输入框上方挂 `QzQuickReplyChips` 快捷回复
/// - assistant 回复前 200ms 思考窗显示 `QzTypingIndicator`，到达后立即显示完整回复
/// - 草稿按 sessionId 独立存储（`_drafts`），切会话不串台
///
class AiHomePage extends ConsumerStatefulWidget {
  const AiHomePage({super.key});

  @override
  ConsumerState<AiHomePage> createState() => _AiHomePageState();
}

class _AiHomePageState extends ConsumerState<AiHomePage> {
  /// 渲染层 controller 保留在 widget（依赖 BuildContext / 渲染层）；
  /// 会话/发送态全量迁入 [AiHomePageController]。
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  /// 同帧去重哨兵：build 期间不可改 provider，故用本地字段挡住同一帧内的重复
  /// 调度；真正的 provider 标记 [`markLoadedStrategy`] 延后到 post-frame 回调。
  String? _pendingLoadStrategyId;
  String? _pendingConfirmHandoffId;
  String? _pendingBacktestHandoffId;
  String? _pendingDeployJobId;

  AiHomePageController get _ctrl =>
      ref.read(aiHomePageControllerProvider.notifier);

  @override
  void initState() {
    super.initState();
    _input.addListener(_persistDraft);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadSessions());
  }

  /// 把输入框文本回写 controller 草稿（不触发本 widget 重建）。
  void _persistDraft() => _ctrl.persistDraft(_input.text);

  Future<void> _loadSessions() async {
    await _ctrl.loadSessions();
    if (!mounted) return;
    final String? id = ref.read(aiHomePageControllerProvider).currentId;
    _syncInputTo(id);
  }

  /// 把输入框文本同步到指定会话草稿（切/建/删会话后调用）。
  void _syncInputTo(String? id) {
    _input.text = id == null ? '' : _ctrl.draftFor(id);
  }

  void _switchSession(String id) {
    final bool switched = _ctrl.switchSession(id);
    if (switched) {
      _syncInputTo(id);
      _scrollToBottom();
    }
    Navigator.of(context).pop(); // 关 drawer（点中当前会话也需关）
  }

  Future<void> _createSession() async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    await _ctrl.createSession(l10n.aiSessionUntitled);
    if (!mounted) return;
    _input.text = '';
    if (_scaffoldKey.currentState?.isDrawerOpen == true) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _deleteSession(String id) async {
    await _ctrl.deleteSession(id);
    if (!mounted) return;
    _syncInputTo(ref.read(aiHomePageControllerProvider).currentId);
  }

  Future<void> _send({String? overrideText}) async {
    final String text = (overrideText ?? _input.text).trim();
    if (text.isEmpty || ref.read(aiHomePageControllerProvider).isSending) {
      return;
    }
    final AiHomePageState st = ref.read(aiHomePageControllerProvider);
    final AiSession? current = st.currentId == null
        ? null
        : st.sessions[st.currentId!];
    final ChatTurn? confirmable = current == null
        ? null
        : _latestConfirmableTurn(current);
    if (_isConfirmIntent(text) && confirmable != null && current != null) {
      _input.clear();
      await _confirmInChat(confirmable, current);
      return;
    }
    _input.clear();
    _scrollToBottom();
    await _ctrl.send(text);
    if (!mounted) return;
    _scrollToBottom();
  }

  Future<void> _openQuickNav(String label) async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AiHomePageState st = ref.read(aiHomePageControllerProvider);
    final AiSession? current = st.currentId == null
        ? null
        : st.sessions[st.currentId!];
    if (label == l10n.aiQuickReply1) {
      final ChatTurn? confirmable = current == null
          ? null
          : _latestConfirmableTurn(current);
      final Object? extra = confirmable == null
          ? _latestParams(current)
          : AiConfirmArgs(
              codegenSessionId: _codegenSessionIdFor(confirmable),
              confirmedCanonicalDigest: _canonicalDigestFor(confirmable),
              params: confirmable.params,
            );
      context.push('/ai/confirm', extra: extra);
      return;
    }
    if (label == l10n.aiQuickReply2) {
      final ChatTurn? resultTurn = current == null
          ? null
          : _latestBacktestResultTurn(current);
      final String? jobId = resultTurn?.backtestSummary?.id.trim();
      if (jobId != null && jobId.isNotEmpty) {
        final AiPublishedStrategyContext? strategyContext =
            resultTurn?.strategyContext ??
            (current == null ? null : _latestPublishedStrategyContext(current));
        context.push(
          '/ai/backtest-result?jobId=${Uri.encodeComponent(jobId)}',
          extra: strategyContext == null
              ? null
              : AiBacktestResultArgs(
                  jobId: jobId,
                  strategyContext: strategyContext,
                ),
        );
        return;
      }
      context.push('/ai/backtest-result');
      return;
    }
    if (label == l10n.aiQuickReply3) {
      await _openDeployFromQuickReply(current);
    }
  }

  Future<void> _openDeployFromQuickReply(AiSession? current) async {
    final AiPublishedStrategyContext? strategyContext = current == null
        ? null
        : _latestPublishedStrategyContext(current);
    final ChatTurn? resultTurn = current == null
        ? null
        : _latestBacktestResultTurn(current);
    final String jobId = resultTurn?.backtestSummary?.id.trim() ?? '';
    if (strategyContext == null || jobId.isEmpty) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('请先完成回测后再部署。')));
      return;
    }
    if (_pendingDeployJobId == jobId) return;
    _pendingDeployJobId = jobId;

    BacktestResult? result;
    try {
      result = await ref.read(backtestRepositoryProvider).getResult(jobId);
    } catch (_) {
      result = _backtestResultFromSummary(resultTurn?.backtestSummary);
    }
    if (!mounted) return;
    context.push(
      '/ai/deploy',
      extra: strategyContext.toDeploymentContext(backtestResult: result),
    );
    _pendingDeployJobId = null;
  }

  BacktestResult? _backtestResultFromSummary(BacktestSummary? summary) {
    if (summary == null) return null;
    final DateTime epoch = DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
    return BacktestResult(
      id: summary.id,
      totalReturnPercent: summary.totalReturnPercent,
      cagrPercent: summary.totalReturnPercent,
      maxDrawdownPercent: summary.maxDrawdownPercent,
      sharpe: 0,
      calmar: 0,
      winRatePercent: 0,
      profitLossRatio: 0,
      avgHoldDuration: '--',
      totalTrades: summary.trades,
      closedReturnPercent: summary.totalReturnPercent,
      closedTrades: summary.trades,
      rangeStart: epoch,
      rangeEnd: epoch,
      equityCurve: const <double>[],
      drawdownMarkers: const <int>[],
      monthlyRows: const <BacktestMonthlyRow>[],
      trades: const <BacktestTrade>[],
      riskRows: const <BacktestRiskRow>[],
      aiAssessment: '',
    );
  }

  Map<String, String>? _latestParams(AiSession? session) {
    if (session == null) return null;
    for (final ChatTurn turn in session.messages.reversed) {
      final Map<String, String>? params = turn.params;
      if (turn.kind == ChatTurnKind.params &&
          params != null &&
          params.isNotEmpty) {
        return params;
      }
    }
    return null;
  }

  AiPublishedStrategyContext? _latestPublishedStrategyContext(
    AiSession session,
  ) {
    for (final ChatTurn turn in session.messages.reversed) {
      final AiPublishedStrategyContext? strategyContext = turn.strategyContext;
      if (strategyContext?.hasPublishedSnapshot == true) {
        return strategyContext;
      }
    }
    return null;
  }

  ChatTurn? _latestBacktestResultTurn(AiSession session) {
    for (final ChatTurn turn in session.messages.reversed) {
      if (turn.kind == ChatTurnKind.result && turn.backtestSummary != null) {
        return turn;
      }
    }
    return null;
  }

  AiPublishedStrategyContext? _latestBacktestableStrategyContext(
    AiSession session,
  ) {
    for (final ChatTurn turn in session.messages.reversed) {
      final AiPublishedStrategyContext? strategyContext = turn.strategyContext;
      if (turn.kind == ChatTurnKind.scriptReady &&
          strategyContext?.hasPublishedSnapshot == true &&
          strategyContext?.requiresRepublishForBacktest != true) {
        return strategyContext;
      }
    }
    return null;
  }

  bool _hasRepublishRequiredBacktestContext(AiSession session) {
    for (final ChatTurn turn in session.messages.reversed) {
      final AiPublishedStrategyContext? strategyContext = turn.strategyContext;
      if (turn.kind == ChatTurnKind.scriptReady &&
          strategyContext?.hasPublishedSnapshot == true) {
        return strategyContext?.requiresRepublishForBacktest == true;
      }
    }
    return false;
  }

  void _openBacktestFromTopBar(AiSession? current) {
    if (current == null) return;
    final AiPublishedStrategyContext? strategyContext =
        _latestBacktestableStrategyContext(current);
    if (strategyContext != null) {
      context.push('/ai/backtest-config', extra: strategyContext);
      return;
    }
    final String message = _hasRepublishRequiredBacktestContext(current)
        ? '当前已发布快照需要重新确认策略后再回测。'
        : '请先确认策略并生成脚本后再回测。';
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _confirmInChat(ChatTurn turn, AiSession session) async {
    final String? codegenSessionId = _codegenSessionIdFor(turn);
    final String? digest = _canonicalDigestFor(turn);
    if (codegenSessionId == null || digest == null) return;
    _scrollToBottom();
    await _ctrl.confirmStrategyInChat(
      session.id,
      codegenSessionId: codegenSessionId,
      confirmedCanonicalDigest: digest,
    );
    if (!mounted) return;
    _scrollToBottom();
  }

  void _openConfirmPage(ChatTurn turn) {
    final String? codegenSessionId = _codegenSessionIdFor(turn);
    final String? digest = _canonicalDigestFor(turn);
    if (codegenSessionId != null || digest != null) {
      context.push(
        '/ai/confirm',
        extra: AiConfirmArgs(
          codegenSessionId: codegenSessionId,
          confirmedCanonicalDigest: digest,
          params: turn.params,
        ),
      );
      return;
    }
    context.push('/ai/confirm', extra: turn.params);
  }

  bool _isConfirmIntent(String text) {
    final String normalized = text.trim().toLowerCase();
    if (normalized.isEmpty || normalized.length > 12) return false;
    const Set<String> exact = <String>{
      '是',
      '确认',
      '可以',
      '好的',
      '好',
      '开始',
      '生成',
      '生成脚本',
      '确认策略',
      '按这个生成',
      'yes',
      'ok',
      'go',
    };
    if (exact.contains(normalized)) return true;
    return normalized.contains('确认') && normalized.contains('生成');
  }

  ChatTurn? _latestConfirmableTurn(AiSession session) {
    if (session.deployedTo != null) return null;
    final List<ChatTurn> messages = session.messages;
    if (messages.isEmpty) return null;
    final ChatTurn turn = messages.last;
    if (turn.role != 'assistant' || turn.kind == ChatTurnKind.deployed) {
      return null;
    }
    return _hasCodegenMetadata(turn) ? turn : null;
  }

  bool _hasCodegenMetadata(ChatTurn turn) {
    return _codegenSessionIdFor(turn) != null &&
        _canonicalDigestFor(turn) != null;
  }

  String? _codegenSessionIdFor(ChatTurn turn) {
    return _firstNonBlank(<String?>[
      turn.codegenSessionId,
      turn.params?['codegenSessionId'],
      turn.params?['llmCodegenSessionId'],
      turn.params?['activeCodegenSessionId'],
      turn.params?['sessionId'],
    ]);
  }

  String? _canonicalDigestFor(ChatTurn turn) {
    return _firstNonBlank(<String?>[
      turn.confirmedCanonicalDigest,
      turn.params?['confirmedCanonicalDigest'],
      turn.params?['canonicalDigest'],
      turn.params?['pendingCanonicalDigest'],
    ]);
  }

  String? _firstNonBlank(Iterable<String?> values) {
    for (final String? value in values) {
      final String trimmed = value?.trim() ?? '';
      if (trimmed.isNotEmpty) return trimmed;
    }
    return null;
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  void dispose() {
    _input.removeListener(_persistDraft);
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  /// 处理 `?loadStrategy=<id>` query：拉策略详情 → 选/建会话 → 注入预设消息。
  ///
  /// 设计：
  /// - 必须等 `loadSessions()` 完成（state.initialized == true）才能动手，否则
  ///   会话 map 是空的，新建出的会话会被随后的 listSessions 覆盖。
  /// - 当前会话**为空**（仅 greeting）→ 复用；否则新建一个以策略命名的会话。
  /// - 注入「user 文本 + assistant params」两条消息（文案在 widget 层取 l10n）。
  Future<void> _handleLoadStrategy(String id) async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    await _ctrl.handleLoadStrategy(
      id,
      userMessage: l10n.aiLoadStrategyUserMessage,
      replyMessage: l10n.aiLoadStrategyReply,
      newSessionTitleFallback: l10n.aiSessionUntitled,
    );
    if (!mounted) return;
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AiHomePageState>(aiHomePageControllerProvider, (
      AiHomePageState? previous,
      AiHomePageState next,
    ) {
      if (!mounted) return;
      final int previousCount = _messageCount(previous);
      final int nextCount = _messageCount(next);
      if (previousCount != nextCount) {
        _scrollToBottom();
      }
    });

    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AiHomePageState st = ref.watch(aiHomePageControllerProvider);
    final AiConfirmChatHandoff? confirmHandoff = ref.watch(
      aiConfirmChatHandoffProvider,
    );
    final AiBacktestChatHandoff? backtestHandoff = ref.watch(
      aiBacktestChatHandoffProvider,
    );
    final AiSession? current = st.currentId == null
        ? null
        : st.sessions[st.currentId!];

    // 处理 `?loadStrategy=<id>` query — 必须在初始化完成后才动手。
    // GoRouterState 在 shell 内分支也能读到当前 location 的 uri。
    final String? loadStrategyId = GoRouterState.of(
      context,
    ).uri.queryParameters['loadStrategy'];
    if (st.initialized &&
        loadStrategyId != null &&
        loadStrategyId.isNotEmpty &&
        loadStrategyId != st.lastLoadedStrategyId &&
        loadStrategyId != _pendingLoadStrategyId) {
      // 同帧去重用本地字段（不触发 provider 写），provider 标记与注入延后到
      // post-frame 回调，避免在 build 期间改 provider 触发 riverpod 断言。
      _pendingLoadStrategyId = loadStrategyId;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _ctrl.markLoadedStrategy(loadStrategyId);
        _handleLoadStrategy(loadStrategyId);
      });
    }

    final String? handoffId = confirmHandoff?.result.id.trim();
    if (st.initialized &&
        confirmHandoff != null &&
        handoffId != null &&
        handoffId.isNotEmpty &&
        handoffId != _pendingConfirmHandoffId) {
      _pendingConfirmHandoffId = handoffId;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted) return;
        ref.read(aiConfirmChatHandoffProvider.notifier).clear();
        await _ctrl.consumeConfirmHandoff(
          confirmHandoff.result,
          newSessionTitleFallback: l10n.aiSessionUntitled,
        );
        if (!mounted) return;
        _pendingConfirmHandoffId = null;
        _scrollToBottom();
      });
    }

    final String? backtestHandoffId = backtestHandoff?.result.id.trim();
    if (st.initialized &&
        backtestHandoff != null &&
        backtestHandoffId != null &&
        backtestHandoffId.isNotEmpty &&
        backtestHandoffId != _pendingBacktestHandoffId) {
      _pendingBacktestHandoffId = backtestHandoffId;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted) return;
        ref.read(aiBacktestChatHandoffProvider.notifier).clear();
        await _ctrl.consumeBacktestHandoff(
          backtestHandoff.result,
          strategyContext: backtestHandoff.strategyContext,
          sessionId: backtestHandoff.sessionId,
          newSessionTitleFallback: l10n.aiSessionUntitled,
        );
        if (!mounted) return;
        _pendingBacktestHandoffId = null;
        _scrollToBottom();
      });
    }

    final List<String> quickReplies = <String>[
      l10n.aiQuickReply1,
      l10n.aiQuickReply2,
      l10n.aiQuickReply3,
    ];

    final List<ChatTurn> messages = current?.messages ?? <ChatTurn>[];
    // typing indicator 占一个虚拟 slot；只在 thinking 阶段显示
    final int extraTyping = st.isThinking ? 1 : 0;
    final int itemCount = messages.length + extraTyping;

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: c.bg,
      drawer: st.initialized
          ? QzAiSessionDrawer(
              sessions: st.orderedSessions,
              currentId: st.currentId,
              onSelect: _switchSession,
              onCreate: _createSession,
              onDelete: _deleteSession,
            )
          : null,
      appBar: QzAiTopBar(
        title: current?.title,
        subtitle: current == null ? null : _formatSubtitle(current),
        historyTooltip: l10n.aiAppBarHistoryTooltip,
        backtestTooltip: l10n.aiAppBarBacktestTooltip,
        backtestLabel: l10n.aiAppBarBacktestButton,
        newSessionTooltip: l10n.aiAppBarNewSessionTooltip,
        onOpenHistory: () => _scaffoldKey.currentState?.openDrawer(),
        onOpenBacktest: () => _openBacktestFromTopBar(current),
        onNewSession: _createSession,
      ),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Expanded(
              child: !st.initialized
                  ? const Center(child: CircularProgressIndicator())
                  : current == null && st.loadError != null
                  ? _LoadError(
                      scheme: c,
                      error: st.loadError!,
                      onRetry: _loadSessions,
                      onCreate: _createSession,
                    )
                  : current == null
                  ? _Empty(scheme: c, onCreate: _createSession)
                  : ListView.separated(
                      controller: _scroll,
                      padding: const EdgeInsets.all(QzSpacing.lg),
                      itemCount: itemCount,
                      separatorBuilder: (BuildContext context, int index) =>
                          const SizedBox(height: QzSpacing.md),
                      itemBuilder: (BuildContext ctx, int i) {
                        if (i < messages.length) {
                          final ChatTurn t = messages[i];
                          final QzChatRole role = switch (t.role) {
                            'user' => QzChatRole.user,
                            'system' => QzChatRole.system,
                            _ => QzChatRole.assistant,
                          };
                          final bool isDeployed =
                              t.kind == ChatTurnKind.deployed;
                          final QzScriptBubbleState? scriptState =
                              switch (t.kind) {
                                ChatTurnKind.scriptGenerating =>
                                  QzScriptBubbleState.generating,
                                ChatTurnKind.scriptReady =>
                                  QzScriptBubbleState.ready,
                                _ => null,
                              };
                          final bool canConfirm =
                              t.role == 'assistant' &&
                              !isDeployed &&
                              identical(t, _latestConfirmableTurn(current));
                          final String? liveId =
                              t.deployedInstanceId ??
                              (isDeployed ? current.deployedTo : null);
                          return QzChatBubble(
                            role: role,
                            content: t.content,
                            time: role == QzChatRole.system
                                ? null
                                : t.timestamp,
                            params: t.kind == ChatTurnKind.params
                                ? t.params
                                : null,
                            scriptState: scriptState,
                            codeBlock: t.kind == ChatTurnKind.scriptReady
                                ? t.strategyContext?.scriptCode?.trim()
                                : null,
                            onStartBacktest:
                                t.kind == ChatTurnKind.scriptReady &&
                                    t.strategyContext?.hasPublishedSnapshot ==
                                        true
                                ? () => context.push(
                                    '/ai/backtest-config',
                                    extra: t.strategyContext,
                                  )
                                : null,
                            // 「确认策略」CTA：只确认当前 CONFIRM_GATE；确认后
                            // 才生成脚本，并把 PUBLISHED 脚本回复回聊天。
                            onConfirm:
                                t.role == 'assistant' &&
                                    !isDeployed &&
                                    (canConfirm ||
                                        t.kind == ChatTurnKind.params)
                                ? () => _openConfirmPage(t)
                                : null,
                            // 已部署锁定态（#1834）：会话 `deployedTo != null`
                            // 时参数卡顶显示锁定横幅并隐藏「确认策略」CTA。
                            locked: current.deployedTo != null,
                            // 部署终态富气泡（#1833）：传交易所 / 实例 ID +
                            // 「查看实盘策略」CTA（跳 `/me/live/:id`），气泡内渲染
                            // ✓ + 运行中状态 + 归档话术。
                            deployedExchange: isDeployed
                                ? t.deployedExchange
                                : null,
                            deployedInstanceId: isDeployed ? liveId : null,
                            onViewLive: isDeployed && liveId != null
                                ? () => context.push('/me/live/$liveId')
                                : null,
                          );
                        }
                        return const QzTypingIndicator();
                      },
                    ),
            ),
            if (st.initialized && current != null)
              QzQuickReplyChips(labels: quickReplies, onTap: _openQuickNav),
            _InputBar(
              controller: _input,
              isSending: st.isSending,
              enabled: current != null,
              onSend: _send,
            ),
          ],
        ),
      ),
    );
  }

  int _messageCount(AiHomePageState? state) {
    if (state?.currentId == null) return 0;
    return state!.sessions[state.currentId!]?.messages.length ?? 0;
  }

  String _formatSubtitle(AiSession s) {
    final List<String> parts = <String>[s.category];
    if (s.pair != null) parts.add(s.pair!);
    if (s.timeframe != null) parts.add(s.timeframe!);
    return parts.join(' · ');
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.scheme, required this.onCreate});

  final QzColorScheme scheme;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(QzSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              l10n.aiSessionEmptyHint,
              style: TextStyle(color: scheme.textDim, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: QzSpacing.lg),
            ElevatedButton.icon(
              key: const Key('ai-empty-create'),
              onPressed: onCreate,
              icon: const Icon(Icons.add, size: 16),
              label: Text(l10n.aiSessionNewButton),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadError extends StatelessWidget {
  const _LoadError({
    required this.scheme,
    required this.error,
    required this.onRetry,
    required this.onCreate,
  });

  final QzColorScheme scheme;
  final String error;
  final VoidCallback onRetry;
  final VoidCallback onCreate;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(QzSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              l10n.commonLoadError,
              key: const Key('ai-load-error-title'),
              style: TextStyle(
                color: scheme.text,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: QzSpacing.sm),
            Text(
              error,
              key: const Key('ai-load-error-detail'),
              style: TextStyle(color: scheme.textDim, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: QzSpacing.lg),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                OutlinedButton(
                  key: const Key('ai-load-retry'),
                  onPressed: onRetry,
                  child: Text(l10n.commonRetry),
                ),
                const SizedBox(width: QzSpacing.sm),
                ElevatedButton.icon(
                  key: const Key('ai-load-create'),
                  onPressed: onCreate,
                  icon: const Icon(Icons.add, size: 16),
                  label: Text(l10n.aiSessionNewButton),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// 设计稿 `ScreenAIChat` 输入区：圆角容器，内嵌 34x34 send icon button。
///
/// 监听 controller 变化以驱动 send 按钮的启用/渐变态。
class _InputBar extends StatefulWidget {
  const _InputBar({
    required this.controller,
    required this.isSending,
    required this.enabled,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool isSending;
  final bool enabled;
  final VoidCallback onSend;

  @override
  State<_InputBar> createState() => _InputBarState();
}

class _InputBarState extends State<_InputBar> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
  }

  @override
  void didUpdateWidget(covariant _InputBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_onChanged);
      widget.controller.addListener(_onChanged);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool canInteract = widget.enabled && !widget.isSending;
    final bool hasText = widget.controller.text.trim().isNotEmpty;

    return Container(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.sm,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(top: BorderSide(color: c.border)),
      ),
      child: Container(
        decoration: BoxDecoration(
          color: c.bgInput,
          border: Border.all(color: hasText ? c.accent : c.border),
          borderRadius: BorderRadius.circular(18),
        ),
        padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg,
          QzSpacing.sm,
          QzSpacing.sm,
          QzSpacing.sm,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: <Widget>[
            Expanded(
              child: TextField(
                key: const Key('ai-chat-input'),
                controller: widget.controller,
                enabled: canInteract,
                minLines: 1,
                maxLines: 4,
                style: TextStyle(color: c.text, fontSize: 14),
                decoration: InputDecoration(
                  hintText: l10n.aiInputHint,
                  hintStyle: TextStyle(color: c.textDim, fontSize: 14),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 6),
                ),
                onSubmitted: (_) => widget.onSend(),
              ),
            ),
            const SizedBox(width: QzSpacing.sm),
            _SendIconButton(
              // 视觉上的禁用态由 hasText 决定，但 tap 永远可达：
              // `_send` 内部已对 empty / sending 做了守卫，并且这样
              // 可以避免 `enterText → tap` 时 listener 尚未 rebuild
              // 而 InkWell.onTap 仍为 null 导致 tap 被吞的问题。
              enabled: hasText,
              tappable: canInteract,
              loading: widget.isSending,
              onPressed: widget.onSend,
              scheme: c,
              tooltip: l10n.aiSendButton,
            ),
          ],
        ),
      ),
    );
  }
}

/// 34x34 内嵌 send icon button：有输入时显示 accent 渐变与阴影，否则为 muted 禁用态。
class _SendIconButton extends StatelessWidget {
  const _SendIconButton({
    required this.enabled,
    required this.tappable,
    required this.loading,
    required this.onPressed,
    required this.scheme,
    required this.tooltip,
  });

  /// 视觉启用（有文本输入），驱动渐变 + accent 阴影。
  final bool enabled;

  /// 是否响应 tap（会话存在且未在发送中）。
  final bool tappable;
  final bool loading;
  final VoidCallback onPressed;
  final QzColorScheme scheme;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    final Widget child = loading
        ? SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(scheme.accentOn),
            ),
          )
        : Icon(
            Icons.arrow_upward_rounded,
            size: 18,
            color: enabled ? scheme.accentOn : scheme.textDim,
          );

    final BoxDecoration decoration = enabled
        ? BoxDecoration(
            gradient: scheme.accentGrad,
            borderRadius: BorderRadius.circular(10),
            boxShadow: <BoxShadow>[scheme.accentShadow],
          )
        : BoxDecoration(
            color: scheme.bgSoft,
            borderRadius: BorderRadius.circular(10),
          );

    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: const Key('ai-send-button'),
          onTap: tappable && !loading ? onPressed : null,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: decoration,
            child: child,
          ),
        ),
      ),
    );
  }
}
