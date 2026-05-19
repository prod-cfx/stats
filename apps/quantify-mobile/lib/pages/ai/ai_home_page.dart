import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/ai_chat_models.dart';
import '../../data/models/backtest_models.dart';
import '../../data/models/deploy_models.dart';
import '../../data/providers.dart';
import '../../data/repositories/ai_chat_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_ai_session_drawer.dart';
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
/// Debug-mode `ai-counter-inc` AppBar 按钮保留，被
/// `test/router/app_router_test.dart` 'branch state is preserved' 依赖。
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
  int _count = 0;

  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();
  Timer? _streamTimer;
  BacktestResult? _backtest;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  bool _initialized = false;
  bool get _isSending => _isThinking || _isStreaming;

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
      _backtest = null;
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
      _backtest = null;
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

  Future<void> _openBacktestSheet() async {
    final Object? result = await context.push<Object?>('/ai/backtest-config');
    if (!mounted) return;
    if (result is BacktestResult) {
      setState(() => _backtest = result);
      _scrollToBottom();
    }
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(l10n.deployDoneToast)),
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
    _input.removeListener(_persistDraft);
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  List<AiSession> get _orderedSessions => <AiSession>[
        for (final String id in _order)
          if (_sessions[id] != null) _sessions[id]!,
      ];

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AiSession? current =
        _currentId == null ? null : _sessions[_currentId!];

    final List<String> quickReplies = <String>[
      l10n.aiQuickReply1,
      l10n.aiQuickReply2,
      l10n.aiQuickReply3,
      l10n.aiQuickReply4,
    ];

    final List<ChatTurn> messages = current?.messages ?? <ChatTurn>[];
    // typing indicator 占一个虚拟 slot；只在 thinking 阶段显示
    final int extraTyping = _isThinking ? 1 : 0;
    final int itemCount =
        messages.length + extraTyping + (_backtest == null ? 0 : 1);

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
          if (kDebugMode)
            TextButton(
              key: const Key('ai-counter-inc'),
              onPressed: () => setState(() => _count += 1),
              child: Text('count: $_count'),
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
              onBacktest: _openBacktestSheet,
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

class _InputBar extends StatelessWidget {
  const _InputBar({
    required this.controller,
    required this.isSending,
    required this.enabled,
    required this.onSend,
    required this.onBacktest,
  });

  final TextEditingController controller;
  final bool isSending;
  final bool enabled;
  final VoidCallback onSend;
  final VoidCallback onBacktest;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool canInteract = enabled && !isSending;
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
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: <Widget>[
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: c.bgInput,
                border: Border.all(color: c.border),
                borderRadius: BorderRadius.circular(QzRadii.input),
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: QzSpacing.md,
                vertical: QzSpacing.xs,
              ),
              child: TextField(
                key: const Key('ai-chat-input'),
                controller: controller,
                enabled: canInteract,
                minLines: 1,
                maxLines: 4,
                style: TextStyle(color: c.text, fontSize: 14),
                decoration: InputDecoration(
                  hintText: l10n.aiInputHint,
                  hintStyle: TextStyle(color: c.textDim, fontSize: 14),
                  border: InputBorder.none,
                  isDense: true,
                ),
                onSubmitted: (_) => onSend(),
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          QzButton(
            key: const Key('ai-backtest-button'),
            label: l10n.aiBacktestButton,
            variant: QzButtonVariant.ghost,
            onPressed: canInteract ? onBacktest : null,
          ),
          const SizedBox(width: QzSpacing.sm),
          QzButton(
            key: const Key('ai-send-button'),
            label: l10n.aiSendButton,
            variant: QzButtonVariant.accent,
            onPressed: canInteract ? onSend : null,
            loading: isSending,
          ),
        ],
      ),
    );
  }
}
