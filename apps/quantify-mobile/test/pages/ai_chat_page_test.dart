import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import '../helpers/test_overrides.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/models/ai_chat_models.dart';
import 'package:quantify_mobile/data/models/ai_strategy_context.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/ai_chat_repository.dart';
import 'package:quantify_mobile/pages/ai/ai_home_page.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_context.dart';
import 'package:quantify_mobile/widgets/qz_glyph_icon.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// Pump AI page with a minimal router. Sized 400×1200 so 3 mock sessions +
/// input bar fit; await an extra 100ms tick so `_loadSessions` (50ms repo
/// delay) resolves before assertions.
Future<void> _pump(WidgetTester tester, {List<Override>? overrides}) async {
  await tester.binding.setSurfaceSize(const Size(400, 1200));
  final GoRouter router = GoRouter(
    initialLocation: '/ai',
    routes: <RouteBase>[
      GoRoute(
        path: '/ai',
        builder: (BuildContext context, GoRouterState state) =>
            const AiHomePage(),
      ),
      GoRoute(
        path: '/ai/confirm',
        builder: (BuildContext context, GoRouterState state) {
          final Object? extra = state.extra;
          final String suffix = extra is AiConfirmArgs
              ? ':${extra.codegenSessionId ?? ''}:${extra.confirmedCanonicalDigest ?? ''}'
              : '';
          return Scaffold(body: Center(child: Text('confirm-route$suffix')));
        },
      ),
      GoRoute(
        path: '/ai/backtest-config',
        builder: (BuildContext context, GoRouterState state) {
          final Object? extra = state.extra;
          final String suffix = extra is AiPublishedStrategyContext
              ? ':${extra.publishedSnapshotId}:${extra.codegenSessionId}'
              : '';
          return Scaffold(
            body: Center(child: Text('backtest-config-route$suffix')),
          );
        },
      ),
      GoRoute(
        path: '/ai/backtest-result',
        builder: (BuildContext context, GoRouterState state) =>
            const Scaffold(body: Center(child: Text('backtest-result-route'))),
      ),
      GoRoute(
        path: '/ai/deploy',
        builder: (BuildContext context, GoRouterState state) =>
            const Scaffold(body: Center(child: Text('deploy-route'))),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides ?? <Override>[...testRepositoryOverrides],
      child: MaterialApp.router(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(
          const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
        ),
        routerConfig: router,
      ),
    ),
  );
  await tester.pump();
  // 让 postFrame loadSessions（50ms 延迟）解析
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump();
}

class _ConfirmIntentAiChatRepository implements AiChatRepository {
  _ConfirmIntentAiChatRepository({
    AiSession? session,
    this.confirmDelay = Duration.zero,
  }) : session =
           session ??
           AiSession(
             id: 'confirm-session',
             title: '基于 OKX 模拟盘 BTC-U',
             category: '未分类',
             pair: 'BTC-USDT-SWAP',
             timeframe: '15m',
             updatedAt: DateTime(2026, 6, 10, 22, 42),
             llmCodegenSessionId: 'codegen-1',
             pendingCanonicalDigest: 'sha256:canonical-1',
             messages: <ChatTurn>[
               ChatTurn(
                 id: 'assistant-confirm-gate',
                 role: 'assistant',
                 content: '我整理出的策略逻辑如下。请确认是否按这个逻辑生成脚本。',
                 timestamp: DateTime(2026, 6, 10, 22, 42),
                 codegenSessionId: 'codegen-1',
                 confirmedCanonicalDigest: 'sha256:canonical-1',
               ),
             ],
           );

  int sendMessageCalls = 0;
  int confirmStrategyCalls = 0;
  String? confirmedSessionId;
  String? confirmedDigest;

  final AiSession session;
  final Duration confirmDelay;

  @override
  Future<List<AiSession>> listSessions() async => <AiSession>[session];

  @override
  Future<AiSession> createSession({String? title}) async => session;

  @override
  Future<void> deleteSession(String sessionId) async {}

  @override
  Future<ChatTurn> sendMessageTo(String sessionId, ChatTurn turn) async {
    sendMessageCalls++;
    return ChatTurn(
      id: 'unexpected-reply',
      role: 'assistant',
      content: 'should not send',
      timestamp: DateTime(2026, 6, 10, 22, 43),
    );
  }

  @override
  Future<CodegenSessionResponseDto> getCodegenSession(String sessionId) async =>
      throw UnimplementedError();

  @override
  Future<CodegenSessionResponseDto> confirmStrategy(
    String sessionId, {
    required String message,
    String? confirmedCanonicalDigest,
  }) async {
    if (confirmDelay > Duration.zero) {
      await Future<void>.delayed(confirmDelay);
    }
    confirmStrategyCalls++;
    confirmedSessionId = sessionId;
    confirmedDigest = confirmedCanonicalDigest;
    return _publishedCodegenSession(
      id: sessionId,
      canonicalDigest: confirmedCanonicalDigest ?? 'sha256:canonical-1',
    );
  }

  @override
  Stream<ChatTurn> watchSession(String sessionId) =>
      const Stream<ChatTurn>.empty();

  @override
  Future<BacktestSummary?> latestBacktest(String sessionId) async => null;

  @override
  Future<AiSession?> markDeployed(
    String sessionId,
    String publishedSnapshotId, {
    String? exchangeAccountId,
    String? exchangeAccountName,
    Map<String, Object?>? deploymentExecutionConfig,
  }) async => null;
}

CodegenSessionResponseDto _publishedCodegenSession({
  required String id,
  required String canonicalDigest,
}) {
  return CodegenSessionResponseDto(
    (CodegenSessionResponseDtoBuilder b) => b
      ..id = id
      ..status = CodegenSessionResponseDtoStatusEnum.PUBLISHED
      ..canonicalDigest = canonicalDigest
      ..scriptCode = 'export default function strategy() { return true; }'
      ..publishedSnapshotId = 'snapshot-1'
      ..clarificationGate.replace(BuiltMap<String, JsonObject?>()),
  );
}

class _LoadErrorAiChatRepository implements AiChatRepository {
  int listSessionsCalls = 0;
  bool failListSessions = true;

  @override
  Future<List<AiSession>> listSessions() async {
    listSessionsCalls++;
    if (failListSessions) throw StateError('sessions unavailable');
    return const <AiSession>[];
  }

  @override
  Future<AiSession> createSession({String? title}) async => AiSession(
    id: 'new-session',
    title: title ?? '新方案',
    category: '未分类',
    updatedAt: DateTime(2026, 6, 11),
    messages: const <ChatTurn>[],
  );

  @override
  Future<void> deleteSession(String sessionId) async {}

  @override
  Future<ChatTurn> sendMessageTo(String sessionId, ChatTurn turn) async => turn;

  @override
  Future<CodegenSessionResponseDto> getCodegenSession(String sessionId) async =>
      throw UnimplementedError();

  @override
  Future<CodegenSessionResponseDto> confirmStrategy(
    String sessionId, {
    required String message,
    String? confirmedCanonicalDigest,
  }) async => throw UnimplementedError();

  @override
  Stream<ChatTurn> watchSession(String sessionId) =>
      const Stream<ChatTurn>.empty();

  @override
  Future<BacktestSummary?> latestBacktest(String sessionId) async => null;

  @override
  Future<AiSession?> markDeployed(
    String sessionId,
    String publishedSnapshotId, {
    String? exchangeAccountId,
    String? exchangeAccountName,
    Map<String, Object?>? deploymentExecutionConfig,
  }) async => null;
}

void main() {
  testWidgets('AI 对话页：输入消息发送 → user 气泡显示 → 完整 assistant 回复', (
    WidgetTester tester,
  ) async {
    await _pump(tester);

    // Send "hi"
    await tester.enterText(find.byKey(const Key('ai-chat-input')), 'hi');
    await tester.tap(find.byKey(const Key('ai-send-button')));
    // 等 200ms 思考延迟；reply 到达后应完整显示，不再本地逐字吐字。
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.text('hi'), findsOneWidget);
    expect(find.text('已收到："hi"。这是一段 mock 回复。'), findsOneWidget);
  });

  testWidgets('多会话：顶栏点击历史按钮 → 抽屉列出 mock 会话 → 切换会话', (
    WidgetTester tester,
  ) async {
    await _pump(tester);

    // 顶栏标题展示当前会话标题（默认第一条 — 倒序后 = AVAX 待确认）。
    expect(find.text('AVAX 突破 · 待确认'), findsOneWidget);
    expect(
      find.text(
        'AVAX 突破 · '
        '待部署',
      ),
      findsNothing,
    );

    await tester.tap(find.byKey(const Key('ai-appbar-history')));
    await tester.pumpAndSettle();

    // mock session tile 都在。
    expect(find.byKey(const Key('ai-session-tile-s5')), findsOneWidget);
    expect(find.byKey(const Key('ai-session-tile-s1')), findsOneWidget);
    expect(find.byKey(const Key('ai-session-tile-s2')), findsOneWidget);
    expect(find.byKey(const Key('ai-session-tile-s3')), findsOneWidget);

    // 切到 ETH
    await tester.tap(find.byKey(const Key('ai-session-tile-s2')));
    await tester.pumpAndSettle();

    expect(find.text('ETH 4H 均值回归'), findsOneWidget);
  });

  testWidgets('快捷导航 chips：点击进入对应页面，不发送聊天消息', (WidgetTester tester) async {
    await _pump(tester);

    final List<(Key, String, String)> cases = <(Key, String, String)>[
      (const Key('ai-quick-reply-0'), '逻辑图', 'confirm-route'),
      (const Key('ai-quick-reply-1'), '回测结果', 'backtest-result-route'),
      (const Key('ai-quick-reply-2'), '部署', 'deploy-route'),
    ];

    for (final (Key key, String label, String routeText) in cases) {
      await tester.tap(find.byKey(key));
      await tester.pumpAndSettle();
      expect(find.textContaining(routeText), findsOneWidget);
      expect(find.text(label), findsNothing);
      GoRouter.of(tester.element(find.text(routeText))).pop();
      await tester.pumpAndSettle();
    }
  });

  testWidgets('typing indicator：发送消息后到 reply 到达前显示', (
    WidgetTester tester,
  ) async {
    await _pump(tester);

    await tester.enterText(find.byKey(const Key('ai-chat-input')), '测试 typing');
    await tester.tap(find.byKey(const Key('ai-send-button')));
    // 还没过 200ms 思考延迟 → indicator 可见
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byKey(const Key('ai-typing-indicator')), findsOneWidget);

    // 思考延迟过后 → indicator 消失，完整回复立即显示。
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.byKey(const Key('ai-typing-indicator')), findsNothing);
    expect(find.text('已收到："测试 typing"。这是一段 mock 回复。'), findsOneWidget);
  });

  testWidgets('待确认 params 气泡：显示逻辑确认文案和查看逻辑图 CTA', (WidgetTester tester) async {
    await _pump(tester);

    // 默认进入 s5 → 含 params 气泡（fast_ma=5 / slow_ma=20）。
    // params 行通过 RichText 内嵌 TextSpan 渲染，无法用 find.text 命中；
    // 以 Key 为准 + 校验 RichText 子节点的纯文本拼接含 fast_ma 即可。
    final Finder paramsBubble = find.byKey(const Key('ai-bubble-params'));
    expect(paramsBubble, findsOneWidget);
    final Iterable<RichText> richTexts = tester.widgetList<RichText>(
      find.descendant(of: paramsBubble, matching: find.byType(RichText)),
    );
    final String joined = richTexts
        .map((RichText r) => r.text.toPlainText())
        .join('|');
    expect(joined, contains('fast_ma'));
    expect(joined, contains('slow_ma'));
    expect(
      find.text(
        '需要我开始回测吗'
        '?',
      ),
      findsNothing,
    );
    expect(find.text('请先确认策略逻辑，确认后我会继续生成脚本。'), findsOneWidget);
    expect(find.text('查看逻辑图'), findsOneWidget);

    await tester.tap(find.byKey(const Key('ai-bubble-confirm-cta')));
    await tester.pumpAndSettle();
    expect(find.text('confirm-route'), findsOneWidget);
  });

  testWidgets('确认门普通文本：显示确认 CTA，回复「是」后在聊天里生成脚本', (WidgetTester tester) async {
    final _ConfirmIntentAiChatRepository repo = _ConfirmIntentAiChatRepository(
      confirmDelay: const Duration(milliseconds: 50),
    );
    await _pump(
      tester,
      overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
    );

    expect(find.textContaining('请确认是否按这个逻辑生成脚本'), findsOneWidget);
    expect(find.byKey(const Key('ai-bubble-confirm-cta')), findsOneWidget);

    await tester.enterText(find.byKey(const Key('ai-chat-input')), '是');
    await tester.tap(find.byKey(const Key('ai-send-button')));

    await tester.pump();
    expect(
      find.byKey(const Key('ai-bubble-script-generating')),
      findsOneWidget,
    );
    expect(find.text('正在生成策略脚本'), findsOneWidget);
    expect(find.text('确认参数 · 生成代码 · 注入风控'), findsOneWidget);

    await tester.pumpAndSettle();

    expect(repo.sendMessageCalls, 0);
    expect(repo.confirmStrategyCalls, 1);
    expect(repo.confirmedSessionId, 'codegen-1');
    expect(repo.confirmedDigest, 'sha256:canonical-1');
    expect(find.text('确认策略'), findsWidgets);
    expect(find.byKey(const Key('ai-bubble-script-ready')), findsOneWidget);
    expect(find.textContaining('策略脚本已生成'), findsOneWidget);
    expect(
      find.textContaining('export default function strategy'),
      findsOneWidget,
    );
    expect(find.textContaining('```'), findsNothing);
    expect(find.text('开始回测'), findsOneWidget);

    await tester.tap(find.text('开始回测'));
    await tester.pumpAndSettle();
    expect(
      find.text('backtest-config-route:snapshot-1:codegen-1'),
      findsOneWidget,
    );
  });

  testWidgets('DRAFTING 澄清仅有 codegenSessionId 时确认文本继续发送', (
    WidgetTester tester,
  ) async {
    final _ConfirmIntentAiChatRepository repo = _ConfirmIntentAiChatRepository(
      session: AiSession(
        id: 'drafting-clarification-session',
        title: '待补标的策略',
        category: '未分类',
        updatedAt: DateTime(2026, 6, 11, 20),
        messages: <ChatTurn>[
          ChatTurn(
            id: 'drafting-clarification',
            role: 'assistant',
            content: '请选择交易标的',
            timestamp: DateTime(2026, 6, 11, 20),
            codegenSessionId: 'drafting-codegen-session',
          ),
        ],
      ),
    );

    await _pump(
      tester,
      overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
    );

    expect(find.text('请选择交易标的'), findsOneWidget);
    expect(find.byKey(const Key('ai-bubble-confirm-cta')), findsNothing);

    await tester.enterText(find.byKey(const Key('ai-chat-input')), '确认策略');
    await tester.tap(find.byKey(const Key('ai-send-button')));
    await tester.pumpAndSettle();

    expect(find.textContaining('confirm-route'), findsNothing);
    expect(repo.sendMessageCalls, 1);
    expect(find.text('should not send'), findsOneWidget);
  });

  testWidgets('无 codegen metadata 的参数气泡显示查看逻辑图 CTA', (
    WidgetTester tester,
  ) async {
    final _ConfirmIntentAiChatRepository repo = _ConfirmIntentAiChatRepository(
      session: AiSession(
        id: 'params-without-codegen',
        title: '历史参数',
        category: '趋势跟踪',
        updatedAt: DateTime(2026, 6, 10, 22, 42),
        messages: <ChatTurn>[
          ChatTurn(
            id: 'assistant-params',
            role: 'assistant',
            content: '策略参数如下。',
            timestamp: DateTime(2026, 6, 10, 22, 42),
            kind: ChatTurnKind.params,
            params: const <String, String>{
              'category': 'trend',
              'symbol': 'BTC/USDT',
            },
          ),
        ],
      ),
    );

    await _pump(
      tester,
      overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
    );

    expect(find.byKey(const Key('ai-bubble-params')), findsOneWidget);
    expect(find.byKey(const Key('ai-bubble-confirm-cta')), findsOneWidget);
    expect(find.text('查看逻辑图'), findsOneWidget);

    await tester.tap(find.byKey(const Key('ai-bubble-confirm-cta')));
    await tester.pumpAndSettle();
    expect(find.text('confirm-route'), findsOneWidget);
  });

  testWidgets('参数气泡内 codegen metadata 可恢复并在聊天里生成脚本', (
    WidgetTester tester,
  ) async {
    final _ConfirmIntentAiChatRepository repo = _ConfirmIntentAiChatRepository(
      session: AiSession(
        id: 'params-with-codegen',
        title: '真实参数',
        category: '趋势跟踪',
        updatedAt: DateTime(2026, 6, 10, 22, 42),
        messages: <ChatTurn>[
          ChatTurn(
            id: 'assistant-params',
            role: 'assistant',
            content: '策略参数如下。',
            timestamp: DateTime(2026, 6, 10, 22, 42),
            kind: ChatTurnKind.params,
            params: const <String, String>{
              'category': 'trend',
              'symbol': 'BTC/USDT',
              'activeCodegenSessionId': 'codegen-from-params',
              'canonicalDigest': 'sha256:params-digest',
            },
          ),
        ],
      ),
    );

    await _pump(
      tester,
      overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
    );

    await tester.enterText(find.byKey(const Key('ai-chat-input')), '确认策略');
    await tester.tap(find.byKey(const Key('ai-send-button')));
    await tester.pumpAndSettle();

    expect(repo.confirmStrategyCalls, 1);
    expect(repo.confirmedSessionId, 'codegen-from-params');
    expect(repo.confirmedDigest, 'sha256:params-digest');
    expect(find.byKey(const Key('ai-bubble-script-ready')), findsOneWidget);
    expect(find.textContaining('策略脚本已生成'), findsOneWidget);
  });

  testWidgets('参数气泡确认入口携带 codegen session 与 digest 到确认页', (
    WidgetTester tester,
  ) async {
    final _ConfirmIntentAiChatRepository repo = _ConfirmIntentAiChatRepository(
      session: AiSession(
        id: 'params-confirm-route',
        title: '真实参数',
        category: '趋势跟踪',
        updatedAt: DateTime(2026, 6, 10, 22, 42),
        messages: <ChatTurn>[
          ChatTurn(
            id: 'assistant-params',
            role: 'assistant',
            content: '策略参数如下。',
            timestamp: DateTime(2026, 6, 10, 22, 42),
            kind: ChatTurnKind.params,
            params: const <String, String>{
              'category': 'trend',
              'symbol': 'BTC/USDT',
              'activeCodegenSessionId': 'codegen-from-params',
              'canonicalDigest': 'sha256:params-digest',
            },
          ),
        ],
      ),
    );

    await _pump(
      tester,
      overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
    );

    await tester.tap(find.byKey(const Key('ai-bubble-confirm-cta')));
    await tester.pumpAndSettle();

    expect(
      find.text('confirm-route:codegen-from-params:sha256:params-digest'),
      findsOneWidget,
    );
  });

  testWidgets('文本 CONFIRM_GATE 确认入口携带 codegen session 与 digest 到确认页', (
    WidgetTester tester,
  ) async {
    final _ConfirmIntentAiChatRepository repo = _ConfirmIntentAiChatRepository(
      session: AiSession(
        id: 'text-confirm-route',
        title: '真实文本确认',
        category: '趋势跟踪',
        updatedAt: DateTime(2026, 6, 10, 22, 42),
        messages: <ChatTurn>[
          ChatTurn(
            id: 'assistant-confirm',
            role: 'assistant',
            content: '请确认是否按这个逻辑生成脚本。',
            timestamp: DateTime(2026, 6, 10, 22, 42),
            codegenSessionId: 'codegen-from-text',
            confirmedCanonicalDigest: 'sha256:text-digest',
          ),
        ],
      ),
    );

    await _pump(
      tester,
      overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
    );

    await tester.tap(find.byKey(const Key('ai-bubble-confirm-cta')));
    await tester.pumpAndSettle();

    expect(
      find.text('confirm-route:codegen-from-text:sha256:text-digest'),
      findsOneWidget,
    );
  });

  testWidgets('新 user 消息后旧 session codegen 不回落，确认文本继续发送', (
    WidgetTester tester,
  ) async {
    final _ConfirmIntentAiChatRepository repo = _ConfirmIntentAiChatRepository(
      session: AiSession(
        id: 'stale-session-fallback',
        title: '旧策略',
        category: '未分类',
        updatedAt: DateTime(2026, 6, 10, 22, 42),
        llmCodegenSessionId: 'stale-codegen',
        pendingCanonicalDigest: 'sha256:stale',
        messages: <ChatTurn>[
          ChatTurn(
            id: 'old-assistant',
            role: 'assistant',
            content: '旧策略逻辑，请确认。',
            timestamp: DateTime(2026, 6, 10, 22, 42),
          ),
          ChatTurn(
            id: 'new-user',
            role: 'user',
            content: '入场：15m 价格在 EMA20 EMA60 EMA144 上方做多',
            timestamp: DateTime(2026, 6, 10, 22, 43),
          ),
        ],
      ),
    );

    await _pump(
      tester,
      overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
    );

    expect(find.text('旧策略逻辑，请确认。'), findsOneWidget);
    expect(find.byKey(const Key('ai-bubble-confirm-cta')), findsNothing);

    await tester.enterText(find.byKey(const Key('ai-chat-input')), '确认策略');
    await tester.tap(find.byKey(const Key('ai-send-button')));
    await tester.pumpAndSettle();

    expect(repo.sendMessageCalls, 1);
    expect(find.textContaining('confirm-route'), findsNothing);
    expect(find.text('确认策略'), findsOneWidget);
    expect(find.text('should not send'), findsOneWidget);
  });

  testWidgets('会话列表加载失败：不再无限 loading，展示错误并可重试', (WidgetTester tester) async {
    final _LoadErrorAiChatRepository repo = _LoadErrorAiChatRepository();

    await _pump(
      tester,
      overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
    );

    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.byKey(const Key('ai-load-error-title')), findsOneWidget);
    expect(find.text('加载失败'), findsOneWidget);
    expect(find.textContaining('sessions unavailable'), findsOneWidget);

    repo.failListSessions = false;
    await tester.tap(find.byKey(const Key('ai-load-retry')));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump();

    expect(repo.listSessionsCalls, 2);
    expect(find.byKey(const Key('ai-load-error-title')), findsNothing);
    expect(find.text('暂无会话，点击「新建方案」开始一个策略对话。'), findsOneWidget);
  });

  testWidgets('已部署会话：首屏渲染实盘终态卡和查看实盘 CTA', (WidgetTester tester) async {
    await _pump(tester);

    await tester.tap(find.byKey(const Key('ai-appbar-history')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('ai-session-tile-s1')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('ai-bubble-deployed')), findsOneWidget);
    expect(find.text('策略已部署到 Binance'), findsOneWidget);
    expect(find.text('策略 ID QF-AY7K2P · 当前运行中'), findsOneWidget);
    expect(find.byKey(const Key('ai-bubble-view-live')), findsOneWidget);
  });

  testWidgets('删除当前会话 → 自动切到最近会话', (WidgetTester tester) async {
    await _pump(tester);

    await tester.tap(find.byKey(const Key('ai-appbar-history')));
    await tester.pumpAndSettle();

    // 当前 s5 — 抽屉里 s5 tile 上才有删除按钮。
    await tester.tap(find.byKey(const Key('ai-session-delete-s5')));
    await tester.pumpAndSettle();

    // 删除走二次确认弹窗（#2153）；点确认才真正删除。
    expect(find.byKey(const Key('ai-session-delete-dialog')), findsOneWidget);
    await tester.tap(find.byKey(const Key('ai-session-delete-confirm')));
    await tester.pumpAndSettle();

    // s5 不再存在；关掉 drawer 后顶栏标题切到 BTC。
    expect(find.byKey(const Key('ai-session-tile-s5')), findsNothing);
    await tester.tap(find.byKey(const Key('ai-drawer-close')));
    await tester.pumpAndSettle();
    expect(find.text('BTC 趋势 · 双均线'), findsOneWidget);
  });

  testWidgets('顶部栏：历史 + 回测 + 新建会话，无设计稿外的「参数」按钮（#2014）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);

    // #1590 验收：移除 debug-only `count: 0`，确认 widget tree 中不存在。
    expect(find.textContaining('count:'), findsNothing);
    expect(find.byKey(const Key('ai-counter-inc')), findsNothing);

    // 设计稿顶栏：左历史 + 右回测 + 新建会话；无「参数」pill（#2014）。
    expect(find.byKey(const Key('ai-appbar-history')), findsOneWidget);
    expect(find.byKey(const Key('ai-appbar-backtest')), findsOneWidget);
    expect(find.byKey(const Key('ai-appbar-new-session')), findsOneWidget);
    expect(find.text('参数'), findsNothing);

    await tester.tap(find.byKey(const Key('ai-appbar-backtest')));
    await tester.pump();
    expect(find.text('请先确认策略并生成脚本后再回测。'), findsOneWidget);
    expect(find.text('backtest-config-route'), findsNothing);
  });

  testWidgets('顶部栏回测使用当前会话最新已发布策略快照进入配置页', (WidgetTester tester) async {
    final AiPublishedStrategyContext strategyContext =
        AiPublishedStrategyContext.fromCodegen(
          _publishedCodegenSession(
            id: 'codegen-topbar-1',
            canonicalDigest: 'sha256:topbar-1',
          ),
        );
    final _ConfirmIntentAiChatRepository repo = _ConfirmIntentAiChatRepository(
      session: AiSession(
        id: 'published-session',
        title: 'BTC 已发布策略',
        category: '趋势跟踪',
        pair: 'BTC/USDT',
        timeframe: '15m',
        updatedAt: DateTime(2026, 6, 15, 10, 30),
        messages: <ChatTurn>[
          ChatTurn(
            id: 'published-script-1',
            role: 'assistant',
            content: '策略脚本已生成',
            timestamp: DateTime(2026, 6, 15, 10, 30),
            kind: ChatTurnKind.scriptReady,
            strategyContext: strategyContext,
          ),
        ],
      ),
    );
    await _pump(
      tester,
      overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
    );

    await tester.tap(find.byKey(const Key('ai-appbar-backtest')));
    await tester.pumpAndSettle();

    expect(
      find.text('backtest-config-route:snapshot-1:codegen-topbar-1'),
      findsOneWidget,
    );
  });

  testWidgets('顶栏左/右按钮：32×32 bgSoft 软背景容器 + 设计 glyph，方钮/圆钮圆角各异（#2015）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);

    // 从实际渲染上下文取软背景色，与页面（`c.bgSoft`）共享单一事实源，
    // 主题色调整时测试自动同步，避免硬编码字面值静默失真。
    final BuildContext ctx = tester.element(find.byType(AiHomePage));
    final Color bgSoft = ctx.qzScheme.bgSoft;

    // 校验软背景按钮：背景与圆角由 Material（ink 表面）承载，水波纹才不被遮挡；
    // 内层 32×32 固定尺寸承载 glyph。按钮 Key 在 InkWell 上，向上找最近 Material。
    void expectSoftButton(Key key, double radius) {
      final Finder btn = find.byKey(key);
      expect(btn, findsOneWidget);
      final Material mat = tester.widget<Material>(
        find.ancestor(of: btn, matching: find.byType(Material)).first,
      );
      expect(mat.color, bgSoft);
      expect(mat.borderRadius, BorderRadius.circular(radius));
      // InkWell 内层固定 32×32 视觉尺寸。
      final SizedBox inner = tester.widget<SizedBox>(
        find.descendant(of: btn, matching: find.byType(SizedBox)).first,
      );
      expect(inner.width, 32);
      expect(inner.height, 32);
      // 命中区 48×48 由 _TopBarButton 最外层 SizedBox 提供，且不被 leading 槽 /
      // actions 裁切（回归：leadingWidth 须容纳 padding + 48，否则左钮被裁回 ~32）。
      final Size hit = tester.getSize(
        find.ancestor(of: btn, matching: find.byType(SizedBox)).first,
      );
      expect(hit.width, greaterThanOrEqualTo(48));
      expect(hit.height, greaterThanOrEqualTo(48));
      expect(
        find.descendant(of: btn, matching: find.byType(QzGlyphIcon)),
        findsOneWidget,
      );
    }

    // 左·历史方钮 borderRadius 9；右·新建会话圆钮 borderRadius 999。
    expectSoftButton(const Key('ai-appbar-history'), 9);
    expectSoftButton(const Key('ai-appbar-new-session'), 999);
  });

  testWidgets('顶栏标题字重：fontSize 14 / w700 / letterSpacing -0.2（#2015）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);

    final Text title = tester.widget<Text>(find.text('AVAX 突破 · 待确认'));
    expect(title.style?.fontSize, 14);
    expect(title.style?.fontWeight, FontWeight.w700);
    expect(title.style?.letterSpacing, -0.2);
  });

  testWidgets('顶栏占位标题「AI」字重：fontSize 14 / w700 / letterSpacing -0.2（#2015）', (
    WidgetTester tester,
  ) async {
    // 占位标题仅在会话加载完成前（current == null）出现，故只 pump 首帧、
    // 不等 loadSessions 解析，覆盖与会话标题独立硬编码的占位样式分支。
    await tester.binding.setSurfaceSize(const Size(400, 1200));
    final GoRouter router = GoRouter(
      initialLocation: '/ai',
      routes: <RouteBase>[
        GoRoute(
          path: '/ai',
          builder: (BuildContext context, GoRouterState state) =>
              const AiHomePage(),
        ),
      ],
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[...testRepositoryOverrides],
        child: MaterialApp.router(
          locale: const Locale('zh'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          theme: buildQzThemeData(
            const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
          ),
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();

    final Text placeholder = tester.widget<Text>(find.text('AI'));
    expect(placeholder.style?.fontSize, 14);
    expect(placeholder.style?.fontWeight, FontWeight.w700);
    expect(placeholder.style?.letterSpacing, -0.2);

    // 排空 postFrame loadSessions（50ms）定时器，避免 dispose 时残留 pending timer。
    await tester.pump(const Duration(milliseconds: 100));
  });

  testWidgets('草稿不串台：在 s5 输入后切到 s2 输入框为空，再切回 s5 草稿仍在', (
    WidgetTester tester,
  ) async {
    await _pump(tester);

    await tester.enterText(
      find.byKey(const Key('ai-chat-input')),
      'draft for s5',
    );
    await tester.pump();

    await tester.tap(find.byKey(const Key('ai-appbar-history')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('ai-session-tile-s2')));
    await tester.pumpAndSettle();

    // s2 输入应为空
    expect(
      (tester.widget(find.byKey(const Key('ai-chat-input'))) as TextField)
          .controller!
          .text,
      isEmpty,
    );

    // 切回 s5
    await tester.tap(find.byKey(const Key('ai-appbar-history')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('ai-session-tile-s5')));
    await tester.pumpAndSettle();

    expect(
      (tester.widget(find.byKey(const Key('ai-chat-input'))) as TextField)
          .controller!
          .text,
      'draft for s5',
    );
  });
}
