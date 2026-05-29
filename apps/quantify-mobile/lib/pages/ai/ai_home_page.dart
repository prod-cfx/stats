import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/ai_chat_models.dart';
import '../../data/models/backtest_models.dart';
import '../../data/models/deploy_models.dart';
import '../../data/models/strategy_models.dart';
import '../../data/providers.dart';
import '../../data/repositories/ai_chat_repository.dart';
import '../../data/repositories/strategy_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_ai_session_drawer.dart';
import '../../widgets/qz_backtest_progress_card.dart';
import '../../widgets/qz_backtest_result_card.dart';
import '../../widgets/qz_button.dart';
import '../../widgets/qz_chat_bubble.dart';
import '../../widgets/qz_deploy_sheet.dart';
import '../../widgets/qz_quick_reply_chips.dart';
import '../../widgets/qz_typing_indicator.dart';

/// AI 多会话对话页 — `/ai` tab 根（#1557）。
///
/// 与 #1508 原版的差异：
/// - 会话状态从单一 `_messages` 改为 `Map<String, AiSession>` + currentId
/// - 左侧 Drawer 用 `QzAiSessionDrawer` 列出 / 新建 / 删除会话
/// - 顶栏中部渲染当前会话标题 + 分类副标题
/// - 输入框上方挂 `QzQuickReplyChips` 快捷回复
/// - assistant 回复前 200ms 思考窗显示 `QzTypingIndicator`，到达后切回流式逐字
/// - 草稿按 sessionId 独立存储（`_drafts`），切会话不串台
///
class AiHomePage extends ConsumerStatefulWidget {
  const AiHomePage({super.key});

  @override
  ConsumerState<AiHomePage> createState() => _AiHomePageState();
}

class _AiHomePageState extends ConsumerState<AiHomePage> {
  /// Streaming cadence: 1 char / 250 ms. 保留 #1508 节奏。
  static const Duration _streamTick = Duration(milliseconds: 250);

  /// 会话状态（mock 全内存）。首次 build 后由 repository.listSessions 填充。
  final Map<String, AiSession> _sessions = <String, AiSession>{};
  final List<String> _order = <String>[]; // 保留排序（按 updatedAt 倒序）
  String? _currentId;

  /// 每个会话独立的输入草稿。
  final Map<String, String> _drafts = <String, String>{};

  /// 当前会话的「正在思考」窗口（reply 到达前的 200ms）。
  bool _isThinking = false;
  bool _isStreaming = false;

  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();
  Timer? _streamTimer;
  BacktestResult? _backtest;

  /// 回测阶段（验收 #1751 §3：回测中需明确 UI 表达）。
  /// `running` 渲染进度卡，`done` 渲染结果卡 + 部署按钮，`idle` 不渲染。
  BacktestPhase _btPhase = BacktestPhase.idle;
  double _btProgress = 0;
  Timer? _btTimer;

  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  bool _initialized = false;
  bool get _isSending => _isThinking || _isStreaming;

  /// 已处理过的 `?loadStrategy=<id>` 值，避免同一 query 重复注入消息。
  ///
  /// 用 String? 是因为 GoRouter 在 query 切换为空时也会 rebuild：保留上一次
  /// 处理的 id，新 query 与之相同就跳过；不同（含 null → 非空）则触发一次。
  String? _lastLoadedStrategyId;

  @override
  void initState() {
    super.initState();
    _input.addListener(_persistDraft);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadSessions());
  }

  void _persistDraft() {
    final String? id = _currentId;
    if (id == null) return;
    _drafts[id] = _input.text;
  }

  Future<void> _loadSessions() async {
    final AiChatRepository repo = ref.read(aiChatRepositoryProvider);
    final List<AiSession> list = await repo.listSessions();
    if (!mounted) return;
    setState(() {
      _sessions
        ..clear()
        ..addEntries(list.map((AiSession s) => MapEntry<String, AiSession>(s.id, s)));
      _order
        ..clear()
        ..addAll(list.map((AiSession s) => s.id));
      _currentId = list.isNotEmpty ? list.first.id : null;
      _initialized = true;
      if (_currentId != null) {
        _input.text = _drafts[_currentId!] ?? '';
      }
    });
  }

  void _switchSession(String id) {
    if (id == _currentId) {
      Navigator.of(context).pop();
      return;
    }
    setState(() {
      _currentId = id;
      _input.text = _drafts[id] ?? '';
      _resetBacktest();
      _isThinking = false;
      _isStreaming = false;
      _streamTimer?.cancel();
    });
    Navigator.of(context).pop(); // 关 drawer
    _scrollToBottom();
  }

  Future<void> _createSession() async {
    final AiChatRepository repo = ref.read(aiChatRepositoryProvider);
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AiSession fresh = await repo.createSession(title: l10n.aiSessionUntitled);
    if (!mounted) return;
    setState(() {
      _sessions[fresh.id] = fresh;
      _order.insert(0, fresh.id);
      _currentId = fresh.id;
      _input.text = '';
      _resetBacktest();
    });
    if (_scaffoldKey.currentState?.isDrawerOpen == true) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _deleteSession(String id) async {
    final AiChatRepository repo = ref.read(aiChatRepositoryProvider);
    await repo.deleteSession(id);
    if (!mounted) return;
    setState(() {
      _sessions.remove(id);
      _order.remove(id);
      _drafts.remove(id);
      // 当前会话被删 → 切到最近会话；若全空则保持 null（UI 走空态）
      if (_currentId == id) {
        _currentId = _order.isNotEmpty ? _order.first : null;
        _input.text = _currentId == null ? '' : (_drafts[_currentId!] ?? '');
      }
    });
  }

  Future<void> _send({String? overrideText}) async {
    final String? id = _currentId;
    if (id == null) return;
    final String text = (overrideText ?? _input.text).trim();
    if (text.isEmpty || _isSending) return;

    final AiChatRepository repo = ref.read(aiChatRepositoryProvider);
    final ChatTurn userTurn = ChatTurn(
      id: 'user-${DateTime.now().microsecondsSinceEpoch}',
      role: 'user',
      content: text,
      timestamp: DateTime.now(),
    );
    final AiSession? cur = _sessions[id];
    if (cur != null) {
      setState(() {
        _sessions[id] = cur.copyWith(
          messages: <ChatTurn>[...cur.messages, userTurn],
          updatedAt: DateTime.now(),
        );
        _isThinking = true;
        _drafts[id] = '';
      });
    }
    _input.clear();
    _scrollToBottom();

    ChatTurn reply;
    try {
      reply = await repo.sendMessageTo(id, userTurn);
    } catch (_) {
      if (!mounted) return;
      setState(() => _isThinking = false);
      return;
    }
    if (!mounted) return;

    // Insert an empty assistant turn we will ladder-fill from `reply.content`.
    final AiSession? cur2 = _sessions[id];
    if (cur2 == null) {
      setState(() => _isThinking = false);
      return;
    }
    // mock 已把 userTurn + reply 都追加到 session，这里要把 reply 替换为空内容
    // 让 streaming 重新逐字铺。先剥掉 reply（如果存在），再插入空 reply。
    final List<ChatTurn> base = List<ChatTurn>.of(cur2.messages);
    if (base.isNotEmpty && base.last.id == reply.id) base.removeLast();
    final int idx = base.length;
    setState(() {
      _sessions[id] = cur2.copyWith(
        messages: <ChatTurn>[
          ...base,
          ChatTurn(
            id: reply.id,
            role: reply.role,
            content: '',
            timestamp: reply.timestamp,
            kind: reply.kind,
            params: reply.params,
          ),
        ],
      );
      _isThinking = false;
      _isStreaming = true;
    });

    final String full = reply.content;
    int cursor = 0;
    _streamTimer?.cancel();
    _streamTimer = Timer.periodic(_streamTick, (Timer t) {
      cursor++;
      if (!mounted) {
        t.cancel();
        return;
      }
      final AiSession? s = _sessions[id];
      if (s == null) {
        t.cancel();
        return;
      }
      final List<ChatTurn> msgs = List<ChatTurn>.of(s.messages);
      if (cursor >= full.length) {
        t.cancel();
        msgs[idx] = ChatTurn(
          id: reply.id,
          role: reply.role,
          content: full,
          timestamp: reply.timestamp,
          kind: reply.kind,
          params: reply.params,
        );
        setState(() {
          _sessions[id] = s.copyWith(messages: msgs);
          _isStreaming = false;
        });
        _scrollToBottom();
        return;
      }
      msgs[idx] = ChatTurn(
        id: reply.id,
        role: reply.role,
        content: full.substring(0, cursor),
        timestamp: reply.timestamp,
        kind: reply.kind,
        params: reply.params,
      );
      setState(() => _sessions[id] = s.copyWith(messages: msgs));
      _scrollToBottom();
    });
  }

  /// 回测中进度推进节奏：每 120ms +4%，约 3s 跑完（mock）。
  static const Duration _btTick = Duration(milliseconds: 120);
  static const double _btStep = 0.04;

  /// 清空回测状态（切/删会话、新一轮提问等场景复用），同时停掉计时器。
  void _resetBacktest() {
    _btTimer?.cancel();
    _btTimer = null;
    _backtest = null;
    _btPhase = BacktestPhase.idle;
    _btProgress = 0;
  }

  Future<void> _openBacktestSheet() async {
    final Object? result = await context.push<Object?>('/ai/backtest-config');
    if (!mounted) return;
    if (result is! BacktestResult) return;
    // 先进入「回测中」状态（验收 #3），mock 计时推进到 100% 再切结果卡。
    _btTimer?.cancel();
    setState(() {
      _backtest = result;
      _btPhase = BacktestPhase.running;
      _btProgress = 0;
    });
    _scrollToBottom();
    _btTimer = Timer.periodic(_btTick, (Timer t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      final double next = _btProgress + _btStep;
      if (next >= 1.0) {
        t.cancel();
        setState(() {
          _btProgress = 1.0;
          _btPhase = BacktestPhase.done;
        });
        _scrollToBottom();
        return;
      }
      setState(() => _btProgress = next);
    });
  }

  void _cancelBacktest() {
    setState(_resetBacktest);
  }

  Future<void> _openDeploySheet() async {
    final DeploymentResult? result = await QzDeploySheet.show(context);
    if (!mounted || result == null) return;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String? id = _currentId;
    if (id == null) return;
    final AiSession? cur = _sessions[id];
    if (cur == null) return;
    final String msg =
        '${l10n.deploySystemMessagePrefix}${result.exchange.toUpperCase()}'
        '${l10n.deploySystemMessageInstanceInfix}${result.instanceId}';
    setState(() {
      _sessions[id] = cur.copyWith(
        messages: <ChatTurn>[
          ...cur.messages,
          ChatTurn(
            id: 'system-${DateTime.now().microsecondsSinceEpoch}',
            role: 'system',
            content: msg,
            timestamp: result.deployedAt,
          ),
        ],
      );
    });
    _scrollToBottom();
    // 部署成功后提供「查看实盘策略」入口（#1752）：跳 `/me/live`。
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(l10n.deployDoneToast),
        action: SnackBarAction(
          label: l10n.deployViewLiveStrategies,
          onPressed: () => context.push('/me/live'),
        ),
      ),
    );
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
    _streamTimer?.cancel();
    _btTimer?.cancel();
    _input.removeListener(_persistDraft);
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  List<AiSession> get _orderedSessions => <AiSession>[
        for (final String id in _order)
          if (_sessions[id] != null) _sessions[id]!,
      ];

  /// 处理 `?loadStrategy=<id>` query：拉策略详情 → 选/建会话 → 注入预设消息。
  ///
  /// 设计：
  /// - 必须等 `_loadSessions()` 完成（_initialized == true）才能动手，否则
  ///   会话 map 是空的，新建出的会话会被随后的 listSessions 覆盖。
  /// - 当前会话**为空**（仅 greeting）→ 复用；否则新建一个以策略命名的会话。
  /// - 注入「user 文本 + assistant params」两条消息，params 来源策略 card 字段
  ///   （symbol/period 暂从 tags / category 派生，模型无此字段时回退 mock 默认）。
  Future<void> _handleLoadStrategy(String id) async {
    if (!_initialized) return;
    final StrategyRepository repo =
        ref.read(strategyRepositoryProvider);
    StrategyDetail detail;
    try {
      detail = await repo.getStrategyDetail(id);
    } catch (_) {
      return;
    }
    if (!mounted) return;

    final AiChatRepository chatRepo = ref.read(aiChatRepositoryProvider);
    final AppLocalizations l10n = AppLocalizations.of(context);

    String targetId;
    final AiSession? cur =
        _currentId == null ? null : _sessions[_currentId!];
    // greeting-only 会话视为空：仅 1 条 assistant 消息
    final bool curIsEmpty = cur != null &&
        cur.messages.length <= 1 &&
        cur.messages.every((ChatTurn t) => t.role == 'assistant');
    if (cur != null && curIsEmpty) {
      targetId = cur.id;
    } else {
      final AiSession fresh =
          await chatRepo.createSession(title: detail.card.name);
      if (!mounted) return;
      setState(() {
        _sessions[fresh.id] = fresh;
        _order.insert(0, fresh.id);
        _currentId = fresh.id;
        _input.text = '';
        _resetBacktest();
      });
      targetId = fresh.id;
    }

    final String tagsStr = detail.card.tags.isEmpty
        ? '-'
        : detail.card.tags.take(3).join(' / ');
    final String userText = l10n.aiLoadStrategyUserMessage(
      detail.card.name,
      detail.card.category.name,
      tagsStr,
    );
    final String replyText = l10n.aiLoadStrategyReply(detail.card.name);

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
        'strategy_id': detail.card.id,
        'name': detail.card.name,
        'category': detail.card.category.name,
        'tags': tagsStr,
        'return_7d': '${detail.return7d.toStringAsFixed(2)}%',
        'max_drawdown': '${detail.maxDrawdown.toStringAsFixed(2)}%',
      },
    );

    final AiSession? target = _sessions[targetId];
    if (target == null) return;
    setState(() {
      _sessions[targetId] = target.copyWith(
        messages: <ChatTurn>[...target.messages, userTurn, paramsTurn],
        updatedAt: now,
      );
    });
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AiSession? current =
        _currentId == null ? null : _sessions[_currentId!];

    // 处理 `?loadStrategy=<id>` query — 必须在初始化完成后才动手。
    // GoRouterState 在 shell 内分支也能读到当前 location 的 uri。
    final String? loadStrategyId = GoRouterState.of(context)
        .uri
        .queryParameters['loadStrategy'];
    if (_initialized &&
        loadStrategyId != null &&
        loadStrategyId.isNotEmpty &&
        loadStrategyId != _lastLoadedStrategyId) {
      _lastLoadedStrategyId = loadStrategyId;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _handleLoadStrategy(loadStrategyId);
      });
    }

    final List<String> quickReplies = <String>[
      l10n.aiQuickReply1,
      l10n.aiQuickReply2,
      l10n.aiQuickReply3,
      l10n.aiQuickReply4,
    ];

    final List<ChatTurn> messages = current?.messages ?? <ChatTurn>[];
    // typing indicator 占一个虚拟 slot；只在 thinking 阶段显示
    final int extraTyping = _isThinking ? 1 : 0;
    // running / done 各占一个 slot：running → 进度卡，done → 结果卡 + 部署按钮
    final int extraBacktest = _btPhase == BacktestPhase.idle ? 0 : 1;
    final int itemCount = messages.length + extraTyping + extraBacktest;

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: c.bg,
      drawer: _initialized
          ? QzAiSessionDrawer(
              sessions: _orderedSessions,
              currentId: _currentId,
              onSelect: _switchSession,
              onCreate: _createSession,
              onDelete: _deleteSession,
            )
          : null,
      appBar: AppBar(
        leading: Builder(
          builder: (BuildContext ctx) => IconButton(
            key: const Key('ai-appbar-history'),
            tooltip: l10n.aiAppBarHistoryTooltip,
            icon: const Icon(Icons.history),
            onPressed: () => Scaffold.of(ctx).openDrawer(),
          ),
        ),
        title: current == null
            ? const Text('AI')
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(
                    current.title,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    _formatSubtitle(current),
                    style: TextStyle(fontSize: 11, color: c.textDim),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
        actions: <Widget>[
          IconButton(
            key: const Key('ai-appbar-new-session'),
            tooltip: l10n.aiAppBarNewSessionTooltip,
            icon: const Icon(Icons.add_comment_outlined),
            onPressed: _createSession,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.sm,
              vertical: QzSpacing.sm,
            ),
            child: TextButton.icon(
              key: const Key('ai-backtest-button'),
              onPressed: current == null || _isSending ? null : _openBacktestSheet,
              icon: const Icon(Icons.tune, size: 14),
              label: Text(l10n.aiAppBarParamsButton),
              style: TextButton.styleFrom(
                backgroundColor: c.accentSoft,
                foregroundColor: c.accent,
                disabledForegroundColor: c.textDim,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                minimumSize: const Size(0, 32),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                shape: const StadiumBorder(),
                textStyle: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Expanded(
              child: !_initialized
                  ? const Center(child: CircularProgressIndicator())
                  : current == null
                      ? _Empty(scheme: c, onCreate: _createSession)
                      : ListView.separated(
                          controller: _scroll,
                          padding: const EdgeInsets.all(QzSpacing.lg),
                          itemCount: itemCount,
                          separatorBuilder:
                              (BuildContext context, int index) =>
                                  const SizedBox(height: QzSpacing.md),
                          itemBuilder: (BuildContext ctx, int i) {
                            if (i < messages.length) {
                              final ChatTurn t = messages[i];
                              final QzChatRole role = switch (t.role) {
                                'user' => QzChatRole.user,
                                'system' => QzChatRole.system,
                                _ => QzChatRole.assistant,
                              };
                              return QzChatBubble(
                                role: role,
                                content: t.content,
                                time: role == QzChatRole.system ? null : t.timestamp,
                                params: t.kind == ChatTurnKind.params ? t.params : null,
                              );
                            }
                            if (i < messages.length + extraTyping) {
                              return const QzTypingIndicator();
                            }
                            if (_btPhase == BacktestPhase.running) {
                              return QzBacktestProgressCard(
                                key: const Key('backtest-progress-card'),
                                progress: _btProgress,
                                onCancel: _cancelBacktest,
                              );
                            }
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: <Widget>[
                                QzBacktestResultCard(result: _backtest!),
                                const SizedBox(height: QzSpacing.sm),
                                QzButton(
                                  key: const Key('ai-deploy-button'),
                                  label: l10n.deployButton,
                                  variant: QzButtonVariant.accent,
                                  onPressed: _openDeploySheet,
                                ),
                              ],
                            );
                          },
                        ),
            ),
            if (_initialized && current != null)
              QzQuickReplyChips(
                labels: quickReplies,
                onTap: (String label) => _send(overrideText: label),
              ),
            _InputBar(
              controller: _input,
              isSending: _isSending,
              enabled: current != null,
              onSend: _send,
            ),
          ],
        ),
      ),
    );
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
