import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/data/models/ai_strategy_context.dart';
import 'package:quantify_mobile/data/models/ai_chat_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/ai_chat_repository.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/pages/ai/ai_confirm_page.dart';
import 'package:quantify_mobile/pages/ai/ai_home_page.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

const Map<String, String> _defaultConfirmParams = <String, String>{
  'category': '趋势跟踪',
  'symbol': 'BTC/USDT',
  'period': '15m',
  'fast_ma': '5',
  'slow_ma': '20',
  'stop_loss': '2.0%',
  'leverage': '5x',
};

Future<void> _pump(
  WidgetTester tester, {
  Map<String, String>? params = _defaultConfirmParams,
  AiChatRepository? aiChatRepository,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 1600));
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        if (aiChatRepository != null)
          aiChatRepositoryProvider.overrideWithValue(aiChatRepository),
      ],
      child: MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(
          const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
        ),
        home: AiConfirmPage(params: params),
      ),
    ),
  );
  await tester.pump();
}

CodegenSessionResponseDto _codegenSession({
  required CodegenSessionResponseDtoStatusEnum status,
  String? canonicalDigest,
  Map<String, Object?>? specDesc,
}) {
  return CodegenSessionResponseDto(
    (b) => b
      ..id = 'session-1'
      ..status = status
      ..canonicalDigest = canonicalDigest
      ..scriptCode = 'export default function strategy() { return true; }'
      ..clarificationGate.replace(BuiltMap<String, JsonObject?>())
      ..specDesc.replace(
        BuiltMap<String, JsonObject?>(
          (specDesc ?? const <String, Object?>{}).map(
            (String key, Object? value) =>
                MapEntry<String, JsonObject?>(key, JsonObject(value)),
          ),
        ),
      )
      ..publishedSnapshotParamValues.replace(
        BuiltMap<String, JsonObject?>(<String, JsonObject?>{
          'category': JsonObject('均线突破'),
          'symbol': JsonObject('BTC/USDT'),
          'fast_ma': JsonObject('7'),
          'slow_ma': JsonObject('30'),
        }),
      )
      ..publishedSnapshotId = 'snapshot-1'
      ..strategyInstanceId = 'strategy-1',
  );
}

class _FakeAiChatRepository implements AiChatRepository {
  _FakeAiChatRepository({
    List<CodegenSessionResponseDto>? confirmResponses,
    List<CodegenSessionResponseDto>? getResponses,
    List<Object>? confirmErrors,
  }) : _confirmResponses = List<CodegenSessionResponseDto>.of(
         confirmResponses ?? const <CodegenSessionResponseDto>[],
       ),
       _getResponses = List<CodegenSessionResponseDto>.of(
         getResponses ?? const <CodegenSessionResponseDto>[],
       ),
       _confirmErrors = List<Object>.of(confirmErrors ?? const <Object>[]);

  final List<({String sessionId, String message, String? digest})>
  confirmCalls = <({String sessionId, String message, String? digest})>[];
  final List<String> getCalls = <String>[];
  final List<CodegenSessionResponseDto> _confirmResponses;
  final List<CodegenSessionResponseDto> _getResponses;
  final List<Object> _confirmErrors;
  Object? listSessionsError;
  Duration listSessionsDelay = Duration.zero;
  final List<AiSession> sessions = <AiSession>[
    AiSession(
      id: 'chat-session-1',
      title: 'BTC 趋势 · 双均线',
      category: '趋势跟踪',
      pair: 'BTC/USDT',
      timeframe: '15m',
      updatedAt: DateTime(2026, 6, 12),
      llmCodegenSessionId: 'session-1',
      pendingCanonicalDigest: 'sha256:canonical-1',
      messages: const <ChatTurn>[],
    ),
  ];

  @override
  Future<CodegenSessionResponseDto> getCodegenSession(String sessionId) async {
    getCalls.add(sessionId);
    if (_getResponses.isNotEmpty) return _getResponses.removeAt(0);
    return _codegenSession(
      status: CodegenSessionResponseDtoStatusEnum.CONFIRM_GATE,
      canonicalDigest: 'sha256:canonical-1',
    );
  }

  @override
  Future<CodegenSessionResponseDto> confirmStrategy(
    String sessionId, {
    required String message,
    String? confirmedCanonicalDigest,
  }) async {
    confirmCalls.add((
      sessionId: sessionId,
      message: message,
      digest: confirmedCanonicalDigest,
    ));
    if (_confirmErrors.isNotEmpty) throw _confirmErrors.removeAt(0);
    if (_confirmResponses.isNotEmpty) return _confirmResponses.removeAt(0);
    return _codegenSession(
      status: CodegenSessionResponseDtoStatusEnum.PUBLISHED,
      canonicalDigest: confirmedCanonicalDigest,
    );
  }

  @override
  Future<List<AiSession>> listSessions() async {
    if (listSessionsDelay > Duration.zero) {
      await Future<void>.delayed(listSessionsDelay);
    }
    final Object? error = listSessionsError;
    if (error != null) throw error;
    return sessions;
  }

  @override
  Future<AiSession> getSession(String sessionId) async =>
      sessions.firstWhere((AiSession session) => session.id == sessionId);

  @override
  Future<AiSession> createSession({String? title}) async {
    final AiSession session = AiSession(
      id: 'chat-session-created',
      title: title ?? '新方案',
      category: '未分类',
      updatedAt: DateTime(2026, 6, 12, 1),
      messages: const <ChatTurn>[],
    );
    sessions.insert(0, session);
    return session;
  }

  @override
  Future<void> deleteSession(String sessionId) async {}

  @override
  Future<ChatTurn> sendMessageTo(String sessionId, ChatTurn turn) async =>
      throw UnimplementedError();

  @override
  Stream<ChatTurn> watchSession(String sessionId) =>
      const Stream<ChatTurn>.empty();

  @override
  Future<BacktestSummary?> latestBacktest(String sessionId) async => null;

  @override
  Future<AiSession?> markDeployed(
    String sessionId,
    String publishedSnapshotId, {
    String? strategyName,
    String? exchangeAccountId,
    String? exchangeAccountName,
    Map<String, Object?>? deploymentExecutionConfig,
  }) async => null;
}

void main() {
  testWidgets('无策略数据直达逻辑图页时显示空态', (WidgetTester tester) async {
    final _FakeAiChatRepository repo = _FakeAiChatRepository()
      ..sessions.clear()
      ..listSessionsDelay = const Duration(milliseconds: 1);
    await _pump(tester, params: null, aiChatRepository: repo);

    expect(find.byKey(const Key('ai-confirm-resolving-title')), findsOneWidget);
    expect(find.byKey(const Key('ai-confirm-empty')), findsNothing);

    await tester.pumpAndSettle();

    expect(find.byKey(const Key('ai-confirm-empty')), findsOneWidget);
    expect(find.text('暂无策略逻辑图，请先在 AI 对话中生成策略。'), findsOneWidget);
    expect(find.byKey(const Key('ai-confirm-next-cta')), findsNothing);
  });

  testWidgets('无 route extra 时先检查会话，找到 params 后显示逻辑图', (
    WidgetTester tester,
  ) async {
    final _FakeAiChatRepository repo = _FakeAiChatRepository()
      ..sessions.clear()
      ..listSessionsDelay = const Duration(milliseconds: 1);
    repo.sessions.add(
      AiSession(
        id: 'chat-session-1',
        title: 'BTC 趋势 · 双均线',
        category: '趋势跟踪',
        updatedAt: DateTime(2026, 6, 12),
        llmCodegenSessionId: 'session-1',
        pendingCanonicalDigest: 'sha256:canonical-1',
        messages: <ChatTurn>[
          ChatTurn(
            id: 'params-1',
            role: 'assistant',
            content: '参数已生成',
            timestamp: DateTime(2026, 6, 12),
            kind: ChatTurnKind.params,
            params: const <String, String>{
              'category': '均线突破',
              'symbol': 'BTC/USDT',
              'fast_ma': '7',
              'slow_ma': '30',
            },
            codegenSessionId: 'session-1',
            confirmedCanonicalDigest: 'sha256:canonical-1',
          ),
        ],
      ),
    );

    await _pump(tester, params: null, aiChatRepository: repo);

    expect(find.byKey(const Key('ai-confirm-resolving-title')), findsOneWidget);
    expect(find.byKey(const Key('ai-confirm-empty')), findsNothing);

    await tester.pumpAndSettle();

    expect(find.byKey(const Key('ai-confirm-hero')), findsOneWidget);
    expect(find.byKey(const Key('ai-confirm-empty')), findsNothing);
    expect(find.byKey(const Key('ai-confirm-next-cta')), findsOneWidget);
    expect(repo.getCalls, <String>['session-1']);
  });

  testWidgets('逻辑图状态检查失败时显示重试，不显示空态', (WidgetTester tester) async {
    final _FakeAiChatRepository repo = _FakeAiChatRepository()
      ..listSessionsError = StateError('network down');
    await _pump(tester, params: null, aiChatRepository: repo);
    await tester.pumpAndSettle();

    expect(
      find.byKey(const Key('ai-confirm-resolve-error-title')),
      findsOneWidget,
    );
    expect(find.byKey(const Key('ai-confirm-resolve-retry')), findsOneWidget);
    expect(find.byKey(const Key('ai-confirm-empty')), findsNothing);
  });

  testWidgets('确认策略 fallback market chip 默认合约 5x（#2066）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    expect(find.text('合约 · 5x'), findsOneWidget);
    expect(find.text('合约 · 1x'), findsNothing);
  });

  testWidgets('默认 BTC 确认页 Hero 标题为策略身份而非 symbol+category（#2132）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    expect(find.text('BTC 趋势 · 双均线'), findsOneWidget);
    expect(find.text('BTC/USDT 趋势跟踪'), findsNothing);
  });

  testWidgets('ETH 网格场景按设计稿渲染策略身份与区间/熔断风控（#2132）', (WidgetTester tester) async {
    await _pump(
      tester,
      params: const <String, String>{
        'category': '网格',
        'symbol': 'ETH/USDT',
        'period': '1H',
      },
    );
    expect(find.text('ETH 网格 · 区间震荡'), findsOneWidget);
    // 现货市场 chip（网格无杠杆）。
    expect(find.text('现货'), findsOneWidget);
    // 区间 / 熔断风控告警条。
    expect(find.text('风控 · 区间'), findsOneWidget);
    expect(find.text('风控 · 熔断'), findsOneWidget);
    // 不应出现 BTC 趋势文案。
    expect(find.text('BTC 趋势 · 双均线'), findsNothing);
  });

  testWidgets('确认页不渲染旧五步流程条（#2437）', (WidgetTester tester) async {
    await _pump(tester);

    expect(find.byKey(const Key('qz-step-bar')), findsNothing);
    expect(
      find.text(
        '下一步：'
        '策略脚本',
      ),
      findsNothing,
    );
  });

  testWidgets('确认页主 CTA 保持确认策略，不回流脚本步骤文案（#2437）', (WidgetTester tester) async {
    await _pump(tester);

    expect(find.byKey(const Key('ai-confirm-next-cta')), findsOneWidget);
    expect(find.text('逻辑图'), findsOneWidget);
    expect(find.widgetWithText(InkWell, '确认策略'), findsOneWidget);
    expect(
      find.text(
        '下一步：'
        '策略脚本',
      ),
      findsNothing,
    );
  });

  testWidgets('缺少 codegenSessionId 时不伪装发布态进入脚本页', (WidgetTester tester) async {
    await _pump(tester);

    await tester.tap(find.byKey(const Key('ai-confirm-next-cta')));
    await tester.pump();

    expect(find.text('缺少策略生成会话，请返回 AI 对话重新确认策略。'), findsOneWidget);
  });

  testWidgets('确认页通过真实 codegen session 提交确认后返回 AI 对话并展示脚本卡片', (
    WidgetTester tester,
  ) async {
    final _FakeAiChatRepository repo = _FakeAiChatRepository();
    Object? backtestExtra;
    late final GoRouter router;
    router = GoRouter(
      routes: <RouteBase>[
        GoRoute(path: '/', builder: (_, _) => const SizedBox.shrink()),
        GoRoute(path: '/ai', builder: (_, _) => const AiHomePage()),
        GoRoute(
          path: '/ai/confirm',
          builder: (_, GoRouterState state) => AiConfirmPage(
            args: state.extra is AiConfirmArgs
                ? state.extra! as AiConfirmArgs
                : null,
          ),
        ),
        GoRoute(
          path: '/ai/backtest-config',
          builder: (_, GoRouterState state) {
            backtestExtra = state.extra;
            final Object? extra = state.extra;
            final String suffix = extra is AiPublishedStrategyContext
                ? ':${extra.publishedSnapshotId}:${extra.codegenSessionId}'
                : '';
            return Text('backtest-config-route$suffix');
          },
        ),
        GoRoute(
          path: '/ai/script',
          builder: (_, _) => const Text('script-route'),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
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
    router.push(
      '/ai/confirm',
      extra: const AiConfirmArgs(codegenSessionId: 'session-1'),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('ai-confirm-next-cta')));
    for (int i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 20));
      if (find
          .byKey(const Key('ai-bubble-script-generating'))
          .evaluate()
          .isNotEmpty) {
        break;
      }
    }

    expect(repo.confirmCalls, hasLength(1));
    expect(repo.confirmCalls.single.sessionId, 'session-1');
    expect(repo.confirmCalls.single.message, '确认策略');
    expect(repo.confirmCalls.single.digest, 'sha256:canonical-1');
    expect(
      find.byKey(const Key('ai-bubble-script-generating')),
      findsOneWidget,
    );
    expect(find.text('确认参数 · 生成代码 · 注入风控'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();

    expect(router.routerDelegate.currentConfiguration.uri.path, '/ai');
    expect(find.byKey(const Key('ai-bubble-script-ready')), findsOneWidget);
    expect(
      find.text('export default function strategy() { return true; }'),
      findsOneWidget,
    );
    expect(find.textContaining('```'), findsNothing);
    expect(find.text('script-route'), findsNothing);

    await tester.tap(find.text('开始回测'));
    await tester.pumpAndSettle();

    expect(
      find.text('backtest-config-route:snapshot-1:session-1'),
      findsOneWidget,
    );
    expect(backtestExtra, isA<AiPublishedStrategyContext>());
    final AiPublishedStrategyContext context =
        backtestExtra! as AiPublishedStrategyContext;
    expect(context.publishedSnapshotId, 'snapshot-1');
    expect(context.codegenSessionId, 'session-1');
  });

  testWidgets('确认页优先渲染真实 displayLogicGraph 和 executionContext', (
    WidgetTester tester,
  ) async {
    final _FakeAiChatRepository repo = _FakeAiChatRepository(
      getResponses: <CodegenSessionResponseDto>[
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.CONFIRM_GATE,
          canonicalDigest: 'sha256:canonical-graph',
          specDesc: <String, Object?>{
            'executionContext': <String, Object?>{
              'exchange': 'okx',
              'symbol': 'BTCUSDT',
              'timeframe': '15m',
              'marketType': 'perp',
            },
            'displayLogicGraph': <String, Object?>{
              'blocks': <Object?>[
                <String, Object?>{
                  'items': <Object?>[
                    <String, Object?>{
                      'kind': 'condition',
                      'text':
                          '15m 价格在 EMA20 上方 同时 15m 价格在 EMA60 上方 同时 15m 价格在 EMA144 上方 时做多开仓',
                    },
                    <String, Object?>{'kind': 'action', 'text': '开多'},
                    <String, Object?>{
                      'kind': 'action',
                      'text': '止损：价格相对入场均价下跌5% 强制平仓',
                    },
                    <String, Object?>{'kind': 'action', 'text': '单笔仓位 10 USDT'},
                  ],
                },
                <String, Object?>{
                  'items': <Object?>[
                    <String, Object?>{
                      'kind': 'condition',
                      'text': '15m 价格低于 EMA20 时平多',
                    },
                    <String, Object?>{'kind': 'action', 'text': '平多'},
                  ],
                },
              ],
            },
          },
        ),
      ],
    );

    await tester.binding.setSurfaceSize(const Size(420, 1800));
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp(
          locale: const Locale('zh'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          theme: buildQzThemeData(
            const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
          ),
          home: const AiConfirmPage(
            args: AiConfirmArgs(codegenSessionId: 'session-1'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('BTCUSDT AI 策略'), findsOneWidget);
    expect(find.textContaining('EMA144'), findsOneWidget);
    expect(find.textContaining('15m 价格低于 EMA20'), findsOneWidget);
    expect(find.textContaining('单笔仓位 10 USDT'), findsWidgets);
    final String richText = tester
        .widgetList<RichText>(find.byType(RichText))
        .map((RichText widget) => widget.text.toPlainText())
        .join('|');
    expect(richText, contains('OKX'));
    expect(richText, contains('永续合约'));
    expect(find.text('BTC 趋势 · 双均线'), findsNothing);
  });

  testWidgets('确认后等待后端发布快照，再返回 AI 对话', (WidgetTester tester) async {
    final _FakeAiChatRepository repo = _FakeAiChatRepository(
      getResponses: <CodegenSessionResponseDto>[
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.CONFIRM_GATE,
          canonicalDigest: 'sha256:canonical-1',
        ),
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.CONFIRM_GATE,
          canonicalDigest: 'sha256:canonical-1',
        ),
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.PUBLISHED,
          canonicalDigest: 'sha256:canonical-1',
        ),
      ],
      confirmResponses: <CodegenSessionResponseDto>[
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.GENERATING,
          canonicalDigest: 'sha256:canonical-1',
        ).rebuild((b) => b..publishedSnapshotId = null),
      ],
    );
    late final GoRouter router;
    router = GoRouter(
      routes: <RouteBase>[
        GoRoute(path: '/', builder: (_, _) => const SizedBox.shrink()),
        GoRoute(path: '/ai', builder: (_, _) => const AiHomePage()),
        GoRoute(
          path: '/ai/confirm',
          builder: (_, GoRouterState state) => AiConfirmPage(
            args: state.extra is AiConfirmArgs
                ? state.extra! as AiConfirmArgs
                : null,
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
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
    router.push(
      '/ai/confirm',
      extra: const AiConfirmArgs(codegenSessionId: 'session-1'),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('ai-confirm-next-cta')));
    await tester.pump();
    expect(find.text('确认中...'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();

    expect(repo.confirmCalls, hasLength(1));
    expect(repo.getCalls.take(3), <String>[
      'session-1',
      'session-1',
      'session-1',
    ]);
    expect(router.routerDelegate.currentConfiguration.uri.path, '/ai');
    expect(find.byKey(const Key('ai-bubble-script-ready')), findsOneWidget);
  });

  testWidgets('已发布 session 直接复用快照返回 AI 对话，不重复确认', (WidgetTester tester) async {
    final _FakeAiChatRepository repo = _FakeAiChatRepository(
      getResponses: <CodegenSessionResponseDto>[
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.CONFIRM_GATE,
          canonicalDigest: 'sha256:canonical-1',
        ),
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.PUBLISHED,
          canonicalDigest: 'sha256:canonical-1',
        ).rebuild((b) => b..scriptCode = 'return { ok: true }'),
      ],
    );
    late final GoRouter router;
    router = GoRouter(
      routes: <RouteBase>[
        GoRoute(path: '/', builder: (_, _) => const SizedBox.shrink()),
        GoRoute(path: '/ai', builder: (_, _) => const AiHomePage()),
        GoRoute(
          path: '/ai/confirm',
          builder: (_, GoRouterState state) => AiConfirmPage(
            args: state.extra is AiConfirmArgs
                ? state.extra! as AiConfirmArgs
                : null,
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
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
    router.push(
      '/ai/confirm',
      extra: const AiConfirmArgs(codegenSessionId: 'session-1'),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('ai-confirm-next-cta')));
    await tester.pumpAndSettle();

    expect(repo.confirmCalls, isEmpty);
    expect(router.routerDelegate.currentConfiguration.uri.path, '/ai');
    expect(find.byKey(const Key('ai-bubble-script-ready')), findsOneWidget);
  });

  testWidgets('已确认逻辑图主按钮显示已确认且不可点击', (WidgetTester tester) async {
    final _FakeAiChatRepository repo = _FakeAiChatRepository(
      getResponses: <CodegenSessionResponseDto>[
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.PUBLISHED,
          canonicalDigest: 'sha256:canonical-1',
        ),
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.PUBLISHED,
          canonicalDigest: 'sha256:canonical-1',
        ),
      ],
    );
    late final GoRouter router;
    router = GoRouter(
      routes: <RouteBase>[
        GoRoute(path: '/', builder: (_, _) => const SizedBox.shrink()),
        GoRoute(path: '/ai', builder: (_, _) => const AiHomePage()),
        GoRoute(
          path: '/ai/confirm',
          builder: (_, GoRouterState state) => AiConfirmPage(
            args: state.extra is AiConfirmArgs
                ? state.extra! as AiConfirmArgs
                : null,
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
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
    router.push(
      '/ai/confirm',
      extra: const AiConfirmArgs(codegenSessionId: 'session-1'),
    );
    await tester.pumpAndSettle();

    expect(find.widgetWithText(InkWell, '已确认'), findsOneWidget);
    expect(find.widgetWithText(InkWell, '确认策略'), findsNothing);
    final InkWell nextCta = tester.widget<InkWell>(
      find.byKey(const Key('ai-confirm-next-cta')),
    );
    expect(nextCta.onTap, isNull);

    await tester.tap(find.byKey(const Key('ai-confirm-next-cta')));
    await tester.pumpAndSettle();

    expect(repo.confirmCalls, isEmpty);
    expect(find.byKey(const Key('ai-confirm-disclaimer')), findsOneWidget);
    expect(find.byKey(const Key('ai-bubble-script-ready')), findsNothing);
  });

  testWidgets('确认 409 后拉取已发布 session 恢复脚本上下文', (WidgetTester tester) async {
    final _FakeAiChatRepository repo = _FakeAiChatRepository(
      getResponses: <CodegenSessionResponseDto>[
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.CONFIRM_GATE,
          canonicalDigest: 'sha256:canonical-1',
        ),
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.CONFIRM_GATE,
          canonicalDigest: 'sha256:canonical-1',
        ),
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.PUBLISHED,
          canonicalDigest: 'sha256:canonical-1',
        ),
      ],
      confirmErrors: <Object>[
        const ApiException(
          message: 'conflict',
          statusCode: 409,
          code: 'CONFLICT',
        ),
      ],
    );
    late final GoRouter router;
    router = GoRouter(
      routes: <RouteBase>[
        GoRoute(path: '/', builder: (_, _) => const SizedBox.shrink()),
        GoRoute(path: '/ai', builder: (_, _) => const AiHomePage()),
        GoRoute(
          path: '/ai/confirm',
          builder: (_, GoRouterState state) => AiConfirmPage(
            args: state.extra is AiConfirmArgs
                ? state.extra! as AiConfirmArgs
                : null,
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
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
    router.push(
      '/ai/confirm',
      extra: const AiConfirmArgs(codegenSessionId: 'session-1'),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('ai-confirm-next-cta')));
    await tester.pumpAndSettle();

    expect(repo.confirmCalls, hasLength(1));
    expect(router.routerDelegate.currentConfiguration.uri.path, '/ai');
    expect(find.byKey(const Key('ai-bubble-script-ready')), findsOneWidget);
  });

  testWidgets('digest 不一致时阻止复用旧发布快照', (WidgetTester tester) async {
    final _FakeAiChatRepository repo = _FakeAiChatRepository(
      getResponses: <CodegenSessionResponseDto>[
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.CONFIRM_GATE,
          canonicalDigest: 'sha256:old',
        ),
        _codegenSession(
          status: CodegenSessionResponseDtoStatusEnum.PUBLISHED,
          canonicalDigest: 'sha256:old',
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[aiChatRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp(
          locale: const Locale('zh'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          theme: buildQzThemeData(
            const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
          ),
          home: const AiConfirmPage(
            args: AiConfirmArgs(
              codegenSessionId: 'session-1',
              confirmedCanonicalDigest: 'sha256:new',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('ai-confirm-next-cta')));
    await tester.pumpAndSettle();

    expect(repo.confirmCalls, isEmpty);
    expect(find.textContaining('当前确认内容与后端会话不一致'), findsOneWidget);
  });
}
