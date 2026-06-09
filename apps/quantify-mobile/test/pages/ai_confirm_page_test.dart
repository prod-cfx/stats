import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/data/models/ai_chat_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/ai_chat_repository.dart';
import 'package:quantify_mobile/pages/ai/ai_confirm_page.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_step_bar.dart';

Future<void> _pump(WidgetTester tester, {Map<String, String>? params}) async {
  await tester.binding.setSurfaceSize(const Size(420, 1600));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(
        const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
      ),
      home: AiConfirmPage(params: params),
    ),
  );
  await tester.pump();
}

CodegenSessionResponseDto _codegenSession({
  required CodegenSessionResponseDtoStatusEnum status,
  String? canonicalDigest,
}) {
  return CodegenSessionResponseDto(
    (b) => b
      ..id = 'session-1'
      ..status = status
      ..canonicalDigest = canonicalDigest
      ..clarificationGate.replace(BuiltMap<String, JsonObject?>())
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
  }) : _confirmResponses = List<CodegenSessionResponseDto>.of(
         confirmResponses ?? const <CodegenSessionResponseDto>[],
       ),
       _getResponses = List<CodegenSessionResponseDto>.of(
         getResponses ?? const <CodegenSessionResponseDto>[],
       );

  final List<({String sessionId, String message, String? digest})>
  confirmCalls = <({String sessionId, String message, String? digest})>[];
  final List<String> getCalls = <String>[];
  final List<CodegenSessionResponseDto> _confirmResponses;
  final List<CodegenSessionResponseDto> _getResponses;

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
    if (_confirmResponses.isNotEmpty) return _confirmResponses.removeAt(0);
    return _codegenSession(
      status: CodegenSessionResponseDtoStatusEnum.PUBLISHED,
      canonicalDigest: confirmedCanonicalDigest,
    );
  }

  @override
  Future<List<AiSession>> listSessions() async => <AiSession>[];

  @override
  Future<AiSession> createSession({String? title}) async =>
      throw UnimplementedError();

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
    String? exchangeAccountId,
    Map<String, Object?>? deploymentExecutionConfig,
  }) async => null;
}

void main() {
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

  testWidgets('确认页顶栏下方展示 5 步流程条（#2130）', (WidgetTester tester) async {
    await _pump(tester);

    final Finder stepBar = find.byKey(const Key('qz-step-bar'));
    expect(stepBar, findsOneWidget);

    // 5 步标签按设计稿顺序展示（标签在流程条作用域内唯一）。
    for (final String label in <String>['策略脚本', '回测设置', '回测', '部署']) {
      expect(
        find.descendant(of: stepBar, matching: find.text(label)),
        findsOneWidget,
      );
    }
    // 「确认策略」同时出现在顶栏标题与流程条，限定流程条内仍唯一。
    expect(
      find.descendant(of: stepBar, matching: find.text('确认策略')),
      findsOneWidget,
    );
  });

  testWidgets('确认页流程条 active=0 done 为空（#2130）', (WidgetTester tester) async {
    await _pump(tester);
    final QzStepBar bar = tester.widget<QzStepBar>(find.byType(QzStepBar));
    expect(bar.active, 0);
    expect(bar.done, isEmpty);
    // done 为空 → 无对勾图标。
    expect(
      find.descendant(
        of: find.byType(QzStepBar),
        matching: find.byIcon(Icons.check_rounded),
      ),
      findsNothing,
    );
  });

  testWidgets('确认页通过真实 codegen session 提交确认并透传发布参数', (
    WidgetTester tester,
  ) async {
    final _FakeAiChatRepository repo = _FakeAiChatRepository();
    late final GoRouter router;
    router = GoRouter(
      routes: <RouteBase>[
        GoRoute(path: '/', builder: (_, _) => const SizedBox.shrink()),
        GoRoute(
          path: '/ai/confirm',
          builder: (_, GoRouterState state) => AiConfirmPage(
            args: state.extra is AiConfirmArgs
                ? state.extra! as AiConfirmArgs
                : null,
          ),
        ),
        GoRoute(
          path: '/ai/script',
          builder: (_, GoRouterState state) {
            final Map<String, String> extra = state.extra is Map<String, String>
                ? state.extra! as Map<String, String>
                : const <String, String>{};
            return Text(
              '${extra['codegenStatus']} '
              '${extra['fast_ma']} '
              '${extra['publishedSnapshotId']} '
              '${extra['codegenSessionId']} '
              '${extra['strategyInstanceId']} '
              '${extra['snapshot-1'] ?? '-'}',
            );
          },
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
    expect(repo.confirmCalls.single.sessionId, 'session-1');
    expect(repo.confirmCalls.single.message, '确认策略');
    expect(repo.confirmCalls.single.digest, 'sha256:canonical-1');
    expect(
      find.text('PUBLISHED 7 snapshot-1 session-1 strategy-1 -'),
      findsOneWidget,
    );
  });

  testWidgets('确认后等待后端发布快照，再进入策略脚本页', (WidgetTester tester) async {
    final _FakeAiChatRepository repo = _FakeAiChatRepository(
      getResponses: <CodegenSessionResponseDto>[
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
        GoRoute(
          path: '/ai/confirm',
          builder: (_, GoRouterState state) => AiConfirmPage(
            args: state.extra is AiConfirmArgs
                ? state.extra! as AiConfirmArgs
                : null,
          ),
        ),
        GoRoute(
          path: '/ai/script',
          builder: (_, GoRouterState state) {
            final Map<String, String> extra = state.extra is Map<String, String>
                ? state.extra! as Map<String, String>
                : const <String, String>{};
            return Text(
              '${extra['codegenStatus']} '
              '${extra['publishedSnapshotId']} '
              '${extra['codegenSessionId']}',
            );
          },
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
    expect(repo.getCalls, <String>['session-1', 'session-1']);
    expect(find.text('PUBLISHED snapshot-1 session-1'), findsOneWidget);
  });
}
