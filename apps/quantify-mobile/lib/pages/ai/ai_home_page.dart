import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/ai_chat_models.dart';
import '../../data/models/backtest_models.dart';
import '../../data/providers.dart';
import '../../data/repositories/ai_chat_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_backtest_result_card.dart';
import '../../widgets/qz_button.dart';
import '../../widgets/qz_chat_bubble.dart';

/// AI conversation page — root of the `/ai` tab.
///
/// Renders the live chat stream (`ChatTurn`s + an optional inline
/// `BacktestResult` card), an input bar at the bottom, and a "回测" button
/// that pushes `/ai/backtest-config`. Streaming is simulated client-side at
/// 250 ms / char (issue #1508 requirement); the mock repository returns the
/// final assistant turn synchronously, so we ladder the visible content via
/// a [Timer.periodic] while preserving the repo contract (real API will
/// migrate to a chunked stream without touching this UI).
///
/// Debug-mode `ai-counter-inc` AppBar button is preserved because
/// `test/router/app_router_test.dart` ('branch state is preserved across tab
/// switch') depends on it. It is hidden in release builds.
class AiHomePage extends ConsumerStatefulWidget {
  const AiHomePage({super.key});

  @override
  ConsumerState<AiHomePage> createState() => _AiHomePageState();
}

class _AiHomePageState extends ConsumerState<AiHomePage> {
  /// Streaming cadence: 1 char / 250 ms. Tuned so a typical 30-char reply
  /// finishes in ~7.5 s, matching the prototype "thinking" pacing.
  static const Duration _streamTick = Duration(milliseconds: 250);

  final List<ChatTurn> _messages = <ChatTurn>[];
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();

  BacktestResult? _backtest;
  Timer? _streamTimer;
  bool _isSending = false;
  int _count = 0;

  @override
  void dispose() {
    _streamTimer?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final String text = _input.text.trim();
    if (text.isEmpty || _isSending) return;

    final AiChatRepository repo = ref.read(aiChatRepositoryProvider);
    final ChatTurn userTurn = ChatTurn(
      id: 'user-${DateTime.now().microsecondsSinceEpoch}',
      role: 'user',
      content: text,
      timestamp: DateTime.now(),
    );
    setState(() {
      _messages.add(userTurn);
      _isSending = true;
    });
    _input.clear();
    _scrollToBottom();

    ChatTurn reply;
    try {
      reply = await repo.sendMessage(userTurn);
    } catch (_) {
      if (!mounted) return;
      setState(() => _isSending = false);
      return;
    }
    if (!mounted) return;

    // Insert an empty assistant turn we will ladder-fill from `reply.content`.
    final int idx = _messages.length;
    setState(() {
      _messages.add(ChatTurn(
        id: reply.id,
        role: reply.role,
        content: '',
        timestamp: reply.timestamp,
      ));
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
      if (cursor >= full.length) {
        t.cancel();
        setState(() {
          // ChatTurn is immutable: replace the slot rather than mutating.
          _messages[idx] = ChatTurn(
            id: reply.id,
            role: reply.role,
            content: full,
            timestamp: reply.timestamp,
          );
          _isSending = false;
        });
        _scrollToBottom();
        return;
      }
      setState(() {
        _messages[idx] = ChatTurn(
          id: reply.id,
          role: reply.role,
          content: full.substring(0, cursor),
          timestamp: reply.timestamp,
        );
      });
      _scrollToBottom();
    });
  }

  Future<void> _openBacktestSheet() async {
    final Object? result =
        await context.push<Object?>('/ai/backtest-config');
    if (!mounted) return;
    if (result is BacktestResult) {
      setState(() => _backtest = result);
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    // Defer to next frame so newly-added items are laid out before we jump.
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
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;

    // 1 entry per message + (optional) trailing backtest card.
    final int itemCount = _messages.length + (_backtest == null ? 0 : 1);

    return Scaffold(
      backgroundColor: c.bg,
      appBar: AppBar(
        title: const Text('AI'),
        actions: <Widget>[
          // Debug-only state-preservation probe required by
          // test/router/app_router_test.dart 'branch state is preserved'.
          // Lives behind kDebugMode so release builds never ship it.
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
              child: _messages.isEmpty && _backtest == null
                  ? _Empty(scheme: c)
                  : ListView.separated(
                      controller: _scroll,
                      padding: const EdgeInsets.all(QzSpacing.lg),
                      itemCount: itemCount,
                      separatorBuilder:
                          (BuildContext context, int index) =>
                              const SizedBox(height: QzSpacing.md),
                      itemBuilder: (BuildContext ctx, int i) {
                        if (i < _messages.length) {
                          final ChatTurn t = _messages[i];
                          return QzChatBubble(
                            role: t.role == 'user'
                                ? QzChatRole.user
                                : QzChatRole.assistant,
                            content: t.content,
                            time: t.timestamp,
                          );
                        }
                        return QzBacktestResultCard(result: _backtest!);
                      },
                    ),
            ),
            _InputBar(
              controller: _input,
              isSending: _isSending,
              onSend: _send,
              onBacktest: _openBacktestSheet,
            ),
          ],
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.scheme});

  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(QzSpacing.xl),
        child: Text(
          l10n.aiEmptyHint,
          style: TextStyle(color: scheme.textDim, fontSize: 13),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  const _InputBar({
    required this.controller,
    required this.isSending,
    required this.onSend,
    required this.onBacktest,
  });

  final TextEditingController controller;
  final bool isSending;
  final VoidCallback onSend;
  final VoidCallback onBacktest;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
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
                enabled: !isSending,
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
            onPressed: isSending ? null : onBacktest,
          ),
          const SizedBox(width: QzSpacing.sm),
          QzButton(
            key: const Key('ai-send-button'),
            label: l10n.aiSendButton,
            variant: QzButtonVariant.accent,
            onPressed: isSending ? null : onSend,
            loading: isSending,
          ),
        ],
      ),
    );
  }
}
