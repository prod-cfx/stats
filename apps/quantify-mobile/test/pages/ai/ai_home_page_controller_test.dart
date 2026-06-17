import 'package:fake_async/fake_async.dart';
import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/ai_chat_models.dart';
import 'package:quantify_mobile/data/models/ai_strategy_context.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/ai_chat_repository.dart';
import 'package:quantify_mobile/data/repositories/live_strategy_repository.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/domain/models/live_strategy_models.dart';
import 'package:quantify_mobile/pages/ai/ai_home_page_controller.dart';
import 'package:quantify_mobile/pages/ai/ai_home_page_state.dart';

/// 可控的 fake AiChatRepository：会话内存映射 + 固定 reply，供 controller
/// 流转测试（无真实异步耗时，sendMessageTo 立即返回）。
class _FakeAiChatRepository implements AiChatRepository {
  _FakeAiChatRepository(List<AiSession> seed) : _seed = seed;

  List<AiSession> _seed;
  int _seq = 0;
  int listSessionsCalls = 0;
  int getCodegenSessionCalls = 0;
  final List<String> deletedIds = <String>[];
  Object? listSessionsError;
  Object? getSessionError;
  Object? getCodegenSessionError;
  CodegenSessionResponseDto? codegenSession;
  final Map<String, AiSession> sessionDetails = <String, AiSession>{};

  /// sendMessageTo 返回的固定回复内容。
  String replyContent = 'hi';

  @override
  Future<List<AiSession>> listSessions() async {
    listSessionsCalls++;
    final Object? error = listSessionsError;
    if (error != null) throw error;
    return _seed;
  }

  @override
  Future<AiSession> getSession(String sessionId) async {
    final Object? error = getSessionError;
    if (error != null) throw error;
    final AiSession? detail = sessionDetails[sessionId];
    if (detail != null) return detail;
    return _seed.firstWhere((AiSession s) => s.id == sessionId);
  }

  void replaceSessions(List<AiSession> sessions) {
    _seed = sessions;
  }

  @override
  Future<AiSession> createSession({String? title}) async {
    _seq++;
    return AiSession(
      id: 'new-$_seq',
      title: title ?? 'untitled',
      category: 'cat',
      updatedAt: DateTime(2026, 1, 1),
      messages: const <ChatTurn>[],
    );
  }

  @override
  Future<void> deleteSession(String sessionId) async {
    deletedIds.add(sessionId);
  }

  @override
  Future<ChatTurn> sendMessageTo(String sessionId, ChatTurn turn) async {
    return ChatTurn(
      id: 'reply-$sessionId-${turn.id}',
      role: 'assistant',
      content: replyContent,
      timestamp: DateTime(2026, 1, 2),
    );
  }

  @override
  Future<CodegenSessionResponseDto> getCodegenSession(String sessionId) async =>
      _getCodegenSession(sessionId);

  Future<CodegenSessionResponseDto> _getCodegenSession(String sessionId) async {
    getCodegenSessionCalls++;
    final Object? error = getCodegenSessionError;
    if (error != null) throw error;
    final CodegenSessionResponseDto? response = codegenSession;
    if (response == null) throw StateError('missing codegen session');
    return response;
  }

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
    String? strategyName,
    String? exchangeAccountId,
    String? exchangeAccountName,
    Map<String, Object?>? deploymentExecutionConfig,
  }) async => null;
}

class _FakeLiveStrategyRepository implements LiveStrategyRepository {
  _FakeLiveStrategyRepository(this._strategies);

  final Map<String, LiveStrategy> _strategies;
  Object? getStrategyError;
  Object? listStrategiesError;

  @override
  Future<LiveStrategy> getStrategy(String id) async {
    final Object? error = getStrategyError;
    if (error != null) throw error;
    final LiveStrategy? strategy = _strategies[id];
    if (strategy == null) {
      throw const ApiException(
        message: 'not found',
        statusCode: 404,
        code: 'ACCOUNT_STRATEGY_NOT_FOUND',
      );
    }
    return strategy;
  }

  @override
  Future<List<LiveStrategy>> listStrategies() async {
    final Object? error = listStrategiesError;
    if (error != null) throw error;
    return _strategies.values.toList();
  }

  @override
  Future<LiveStrategySummary> getSummary() async => throw UnimplementedError();

  @override
  Future<LiveStrategyPosition?> getPosition(String id) async => null;

  @override
  Future<List<LiveStrategyTrade>> listTrades(
    String id, {
    int limit = 6,
  }) async => const <LiveStrategyTrade>[];

  @override
  Future<List<LiveStrategyParam>> listParams(String id) async =>
      const <LiveStrategyParam>[];

  @override
  Future<LiveStrategy> pause(String id, {bool liquidate = false}) async =>
      throw UnimplementedError();

  @override
  Future<LiveStrategy> resume(String id) async => throw UnimplementedError();

  @override
  Future<void> softDelete(String id) async {}

  @override
  Future<void> permanentDelete(String id) async {}
}

AiSession _session(String id, {List<ChatTurn>? messages, String? deployedTo}) =>
    AiSession(
      id: id,
      title: 'S-$id',
      category: 'trend',
      updatedAt: DateTime(2026, 1, 1),
      messages:
          messages ??
          (deployedTo == null
              ? const <ChatTurn>[]
              : <ChatTurn>[_scriptReadyTurn('snap-$deployedTo')]),
      deployedTo: deployedTo,
    );

LiveStrategy _liveStrategy(
  String id,
  LiveStrategyStatus status, {
  String? publishedSnapshotId,
}) => LiveStrategy(
  id: id,
  name: 'L-$id',
  pair: 'BTCUSDT',
  timeframe: '15m',
  exchange: 'okx',
  exchangeGlyph: 'O',
  market: '永续',
  status: status,
  runFor: '',
  todayPct: 0,
  todayPnl: 0,
  totalPct: 0,
  totalPnl: 0,
  capital: 0,
  trades: 0,
  winRate: 0,
  spark: const <double>[],
  publishedSnapshotId: publishedSnapshotId ?? 'snap-$id',
);

ChatTurn _scriptReadyTurn(String snapshotId) => ChatTurn(
  id: 'script-$snapshotId',
  role: 'assistant',
  content: '策略脚本已生成',
  timestamp: DateTime(2026, 1, 1),
  kind: ChatTurnKind.scriptReady,
  strategyContext: AiPublishedStrategyContext(
    codegenSessionId: 'codegen-$snapshotId',
    status: 'PUBLISHED',
    params: const <String, String>{},
    snapshotParamValues: const <String, Object?>{},
    strategyConfig: const <String, Object?>{},
    backtestConfigDefaults: const <String, Object?>{},
    deploymentExecutionDefaults: const <String, Object?>{},
    deploymentExecutionConstraints: const <String, Object?>{},
    compatibilityMetadata: const <String, Object?>{},
    publishedSnapshotId: snapshotId,
    scriptCode: 'export default function strategy() {}',
  ),
);

CodegenSessionResponseDto _publishedCodegenSession({
  String id = 'codegen-1',
  String snapshotId = 'snapshot-1',
  String canonicalDigest = 'sha256:restored',
}) {
  return CodegenSessionResponseDto(
    (CodegenSessionResponseDtoBuilder b) => b
      ..id = id
      ..status = CodegenSessionResponseDtoStatusEnum.PUBLISHED
      ..canonicalDigest = canonicalDigest
      ..publishedSnapshotId = snapshotId
      ..scriptCode = 'export default function strategy() { return true; }'
      ..clarificationGate.replace(BuiltMap<String, JsonObject?>())
      ..publishedSnapshotParamValues.replace(
        BuiltMap<String, JsonObject?>(<String, JsonObject?>{
          'symbol': JsonObject('BTCUSDT'),
          'baseTimeframe': JsonObject('15m'),
        }),
      ),
  );
}

void main() {
  ProviderContainer makeContainer(
    _FakeAiChatRepository repo, {
    _FakeLiveStrategyRepository? liveRepo,
  }) {
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        aiChatRepositoryProvider.overrideWithValue(repo),
        liveStrategyRepositoryProvider.overrideWithValue(
          liveRepo ??
              _FakeLiveStrategyRepository(const <String, LiveStrategy>{}),
        ),
      ],
    );
    addTearDown(c.dispose);
    return c;
  }

  AiHomePageController ctrl(ProviderContainer c) =>
      c.read(aiHomePageControllerProvider.notifier);
  AiHomePageState read(ProviderContainer c) =>
      c.read(aiHomePageControllerProvider);

  /// autoDispose provider 无监听者时会在 read 之间释放，使流式 timer 落在已
  /// dispose 的 controller 上。pin 一个 listener 保活，模拟 widget 真实订阅。
  void pin(ProviderContainer c) {
    c.listen(aiHomePageControllerProvider, (_, _) {}, fireImmediately: true);
  }

  group('AiHomePageController', () {
    test('初始态：空会话、未初始化、未发送', () {
      final ProviderContainer c = makeContainer(
        _FakeAiChatRepository(const []),
      );
      final AiHomePageState s = read(c);
      expect(s.sessions, isEmpty);
      expect(s.initialized, isFalse);
      expect(s.isSending, isFalse);
      expect(s.currentId, isNull);
    });

    test('loadSessions 填充会话并选中首条', () async {
      final ProviderContainer c = makeContainer(
        _FakeAiChatRepository(<AiSession>[_session('a'), _session('b')]),
      );
      pin(c);
      await ctrl(c).loadSessions();
      final AiHomePageState s = read(c);
      expect(s.initialized, isTrue);
      expect(s.order, <String>['a', 'b']);
      expect(s.currentId, 'a');
    });

    test('loadSessions 刷新时保留仍存在的当前会话', () async {
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session('a'),
        _session('b'),
      ]);
      final ProviderContainer c = makeContainer(repo);
      pin(c);
      await ctrl(c).loadSessions();
      ctrl(c).switchSession('b');

      repo.replaceSessions(<AiSession>[
        _session('front-new'),
        _session('b'),
        _session('a'),
      ]);
      await ctrl(c).loadSessions();

      final AiHomePageState s = read(c);
      expect(s.order, <String>['front-new', 'b', 'a']);
      expect(s.currentId, 'b');
      expect(repo.listSessionsCalls, 2);
    });

    test('loadSessions 同步当前会话完整远端详情', () async {
      final ChatTurn remoteTurn = ChatTurn(
        id: 'front-msg-1',
        role: 'assistant',
        content: 'front 已生成策略逻辑',
        timestamp: DateTime(2026, 1, 2),
        kind: ChatTurnKind.params,
        params: const <String, String>{'symbol': 'ETHUSDT'},
      );
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session('a'),
      ])..sessionDetails['a'] = _session('a', messages: <ChatTurn>[remoteTurn]);
      final ProviderContainer c = makeContainer(repo);
      pin(c);

      await ctrl(c).loadSessions();

      final AiSession session = read(c).sessions['a']!;
      expect(session.messages, <ChatTurn>[remoteTurn]);
      expect(session.messages.single.params?['symbol'], 'ETHUSDT');
    });

    test('loadSessions 详情失败时保留列表会话并记录错误', () async {
      final ChatTurn listTurn = ChatTurn(
        id: 'list-msg-1',
        role: 'assistant',
        content: 'list cache',
        timestamp: DateTime(2026, 1, 2),
      );
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session('a', messages: <ChatTurn>[listTurn]),
      ])..getSessionError = StateError('detail down');
      final ProviderContainer c = makeContainer(repo);
      pin(c);

      await ctrl(c).loadSessions();

      final AiHomePageState s = read(c);
      expect(s.sessions['a']!.messages, <ChatTurn>[listTurn]);
      expect(s.loadError, contains('detail down'));
    });

    test('switchSessionAndSync 同步新选中会话完整内容', () async {
      final ChatTurn remoteTurn = ChatTurn(
        id: 'front-b-msg-1',
        role: 'assistant',
        content: 'front 会话 b 内容',
        timestamp: DateTime(2026, 1, 2),
      );
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session('a'),
        _session('b'),
      ])..sessionDetails['b'] = _session('b', messages: <ChatTurn>[remoteTurn]);
      final ProviderContainer c = makeContainer(repo);
      pin(c);
      await ctrl(c).loadSessions();

      final bool switched = await ctrl(c).switchSessionAndSync('b');

      final AiHomePageState s = read(c);
      expect(switched, isTrue);
      expect(s.currentId, 'b');
      expect(s.sessions['b']!.messages, <ChatTurn>[remoteTurn]);
    });

    test('loadSessions 刷新时当前会话消失则选中首条', () async {
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session('a'),
        _session('b'),
      ]);
      final ProviderContainer c = makeContainer(repo);
      pin(c);
      await ctrl(c).loadSessions();
      ctrl(c).switchSession('b');

      repo.replaceSessions(<AiSession>[_session('front-new'), _session('a')]);
      await ctrl(c).loadSessions();

      final AiHomePageState s = read(c);
      expect(s.order, <String>['front-new', 'a']);
      expect(s.currentId, 'front-new');
    });

    test('loadSessions 已初始化后刷新失败保留旧会话', () async {
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session('a'),
        _session('b'),
      ]);
      final ProviderContainer c = makeContainer(repo);
      pin(c);
      await ctrl(c).loadSessions();
      ctrl(c).switchSession('b');

      repo.listSessionsError = StateError('network down');
      await ctrl(c).loadSessions();

      final AiHomePageState s = read(c);
      expect(s.initialized, isTrue);
      expect(s.order, <String>['a', 'b']);
      expect(s.currentId, 'b');
      expect(s.loadError, contains('network down'));
    });

    test('loadSessions 只按真实实盘列表回写 deployedTo', () async {
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session('real', messages: <ChatTurn>[_scriptReadyTurn('snap-real')]),
        _session('fake', messages: <ChatTurn>[_scriptReadyTurn('snap-fake')]),
      ]);
      final ProviderContainer c = makeContainer(
        repo,
        liveRepo: _FakeLiveStrategyRepository(<String, LiveStrategy>{
          'live-real': _liveStrategy(
            'live-real',
            LiveStrategyStatus.running,
            publishedSnapshotId: 'snap-real',
          ),
        }),
      );
      pin(c);

      await ctrl(c).loadSessions();

      final AiHomePageState s = read(c);
      expect(s.sessions['real']?.deployedTo, 'live-real');
      expect(s.sessions['fake']?.deployedTo, isNull);
    });

    test('loadSessions 实盘列表失败时部署态 fail closed', () async {
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session(
          'fake',
          messages: <ChatTurn>[_scriptReadyTurn('snap-fake')],
          deployedTo: 'stale-live',
        ),
      ]);
      final _FakeLiveStrategyRepository liveRepo = _FakeLiveStrategyRepository(
        const <String, LiveStrategy>{},
      )..listStrategiesError = StateError('network down');
      final ProviderContainer c = makeContainer(repo, liveRepo: liveRepo);
      pin(c);

      await ctrl(c).loadSessions();

      expect(read(c).sessions['fake']?.deployedTo, isNull);
    });

    test('loadSessions 恢复当前会话远端已发布脚本状态', () async {
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session('a').copyWith(llmCodegenSessionId: 'codegen-1'),
      ])..codegenSession = _publishedCodegenSession();
      final ProviderContainer c = makeContainer(repo);
      pin(c);

      await ctrl(c).loadSessions();

      final AiSession session = read(c).sessions['a']!;
      expect(repo.getCodegenSessionCalls, 1);
      expect(session.messages.length, 2);
      final ChatTurn logic = session.messages.first;
      expect(logic.kind, ChatTurnKind.params);
      expect(logic.params?['symbol'], 'BTCUSDT');
      expect(logic.params?['baseTimeframe'], '15m');
      expect(logic.codegenSessionId, 'codegen-1');
      expect(logic.confirmedCanonicalDigest, 'sha256:restored');
      final ChatTurn restored = session.messages.last;
      expect(restored.kind, ChatTurnKind.scriptReady);
      expect(restored.strategyContext?.publishedSnapshotId, 'snapshot-1');
      expect(restored.strategyContext?.scriptCode, contains('strategy'));
      expect(session.llmCodegenSessionId, 'codegen-1');
      expect(session.pendingCanonicalDigest, 'sha256:restored');
    });

    test('loadSessions 已有 scriptReady 时不重复恢复', () async {
      final ChatTurn ready = ChatTurn(
        id: 'ready-1',
        role: 'assistant',
        content: '策略脚本已生成',
        timestamp: DateTime(2026, 1, 1),
        kind: ChatTurnKind.scriptReady,
      );
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session(
          'a',
          messages: <ChatTurn>[ready],
        ).copyWith(llmCodegenSessionId: 'codegen-1'),
      ])..codegenSession = _publishedCodegenSession();
      final ProviderContainer c = makeContainer(repo);
      pin(c);

      await ctrl(c).loadSessions();

      expect(repo.getCodegenSessionCalls, 0);
      expect(read(c).sessions['a']!.messages, <ChatTurn>[ready]);
    });

    test('loadSessions 远端恢复失败时保留本地聊天记录', () async {
      final ChatTurn local = ChatTurn(
        id: 'local-1',
        role: 'assistant',
        content: '请确认策略',
        timestamp: DateTime(2026, 1, 1),
      );
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session(
          'a',
          messages: <ChatTurn>[local],
        ).copyWith(llmCodegenSessionId: 'codegen-1'),
      ])..getCodegenSessionError = StateError('network down');
      final ProviderContainer c = makeContainer(repo);
      pin(c);

      await ctrl(c).loadSessions();

      expect(repo.getCodegenSessionCalls, 1);
      expect(read(c).sessions['a']!.messages, <ChatTurn>[local]);
    });

    test('loadSessions 失败时结束初始化并记录错误', () async {
      final _FakeAiChatRepository repo = _FakeAiChatRepository(const [])
        ..listSessionsError = StateError('network down');
      final ProviderContainer c = makeContainer(repo);
      pin(c);

      await ctrl(c).loadSessions();

      final AiHomePageState s = read(c);
      expect(s.initialized, isTrue);
      expect(s.currentId, isNull);
      expect(s.sessions, isEmpty);
      expect(s.loadError, contains('network down'));
    });

    test('send 全流转：thinking → 完整 reply 立即显示', () {
      fakeAsync((FakeAsync async) {
        final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
          _session('a'),
        ])..replyContent = 'abc';
        final ProviderContainer c = makeContainer(repo);
        pin(c);

        ctrl(c).loadSessions();
        async.flushMicrotasks();
        expect(read(c).currentId, 'a');

        // 发送：第一个 await 之前同步置 thinking。
        ctrl(c).send('hello');
        expect(read(c).isThinking, isTrue);

        // reply 到达（fake 立即返回，微任务排空）：thinking 关、完整内容出现。
        async.flushMicrotasks();
        final AiHomePageState s = read(c);
        expect(s.isThinking, isFalse);
        final ChatTurn last = s.sessions['a']!.messages.last;
        expect(last.role, 'assistant');
        expect(last.content, 'abc');
      });
    });

    test('send 空文本 / 正在发送时不触发', () {
      fakeAsync((FakeAsync async) {
        final ProviderContainer c = makeContainer(
          _FakeAiChatRepository(<AiSession>[_session('a')])
            ..replyContent = 'xyz',
        );
        pin(c);
        ctrl(c).loadSessions();
        async.flushMicrotasks();

        ctrl(c).send('');
        async.flushMicrotasks();
        expect(read(c).isSending, isFalse);
        expect(read(c).sessions['a']!.messages, isEmpty);

        // 进入发送中后再次 send 被守卫。
        ctrl(c).send('first');
        ctrl(c).send('second');
        async.flushMicrotasks();
        final List<ChatTurn> userTurns = read(c).sessions['a']!.messages
            .where((ChatTurn t) => t.role == 'user')
            .toList();
        expect(userTurns.length, 1);
        async.elapse(const Duration(seconds: 2));
      });
    });

    test('多会话 draft 隔离：切会话不串草稿', () async {
      final ProviderContainer c = makeContainer(
        _FakeAiChatRepository(<AiSession>[_session('a'), _session('b')]),
      );
      pin(c);
      await ctrl(c).loadSessions();
      expect(read(c).currentId, 'a');

      ctrl(c).persistDraft('draft-A');
      expect(read(c).drafts['a'], 'draft-A');

      ctrl(c).switchSession('b');
      expect(read(c).currentId, 'b');
      expect(ctrl(c).draftFor('b'), '');
      ctrl(c).persistDraft('draft-B');
      expect(read(c).drafts['b'], 'draft-B');

      // 切回 a，草稿仍是 A，未被 B 覆盖
      ctrl(c).switchSession('a');
      expect(ctrl(c).draftFor('a'), 'draft-A');
      expect(ctrl(c).draftFor('b'), 'draft-B');
    });

    test('switchSession 点中当前返回 false，切换返回 true', () async {
      final ProviderContainer c = makeContainer(
        _FakeAiChatRepository(<AiSession>[_session('a'), _session('b')]),
      );
      pin(c);
      await ctrl(c).loadSessions();
      expect(ctrl(c).switchSession('a'), isFalse);
      expect(ctrl(c).switchSession('b'), isTrue);
      expect(read(c).currentId, 'b');
    });

    test('renameSession 更新标题、刷新时间并置顶', () async {
      final ProviderContainer c = makeContainer(
        _FakeAiChatRepository(<AiSession>[_session('a'), _session('b')]),
      );
      pin(c);
      await ctrl(c).loadSessions();

      ctrl(c).renameSession('b', '  改名后的会话  ');

      final AiHomePageState s = read(c);
      expect(s.sessions['b']?.title, '改名后的会话');
      expect(s.sessions['b']?.updatedAt.isAfter(DateTime(2026, 1, 1)), isTrue);
      expect(s.order.first, 'b');
    });

    test('renameSession 忽略空标题和不存在的会话', () async {
      final ProviderContainer c = makeContainer(
        _FakeAiChatRepository(<AiSession>[_session('a')]),
      );
      pin(c);
      await ctrl(c).loadSessions();

      ctrl(c).renameSession('a', '   ');
      ctrl(c).renameSession('missing', '新标题');

      final AiHomePageState s = read(c);
      expect(s.sessions['a']?.title, 'S-a');
      expect(s.order, <String>['a']);
    });

    test('deleteSession 删除当前会话切到下一条', () async {
      final ProviderContainer c = makeContainer(
        _FakeAiChatRepository(<AiSession>[_session('a'), _session('b')]),
      );
      pin(c);
      await ctrl(c).loadSessions();
      await ctrl(c).deleteSession('a');
      final AiHomePageState s = read(c);
      expect(s.sessions.containsKey('a'), isFalse);
      expect(s.currentId, 'b');
    });

    test('deleteSession 阻止删除关联运行中实盘策略的会话', () async {
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session('a', deployedTo: 'live-a'),
        _session('b'),
      ]);
      final ProviderContainer c = makeContainer(
        repo,
        liveRepo: _FakeLiveStrategyRepository(<String, LiveStrategy>{
          'live-a': _liveStrategy('live-a', LiveStrategyStatus.running),
        }),
      );
      pin(c);
      await ctrl(c).loadSessions();

      await expectLater(
        ctrl(c).deleteSession('a'),
        throwsA(
          isA<AiSessionDeleteBlockedException>().having(
            (AiSessionDeleteBlockedException e) => e.reason,
            'reason',
            AiSessionDeleteBlockReason.runningStrategy,
          ),
        ),
      );

      final AiHomePageState s = read(c);
      expect(s.sessions.containsKey('a'), isTrue);
      expect(s.currentId, 'a');
      expect(repo.deletedIds, isEmpty);
    });

    test('deleteSession 允许删除关联已停止实盘策略的会话', () async {
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session('a', deployedTo: 'live-a'),
        _session('b'),
      ]);
      final ProviderContainer c = makeContainer(
        repo,
        liveRepo: _FakeLiveStrategyRepository(<String, LiveStrategy>{
          'live-a': _liveStrategy('live-a', LiveStrategyStatus.stopped),
        }),
      );
      pin(c);
      await ctrl(c).loadSessions();
      await ctrl(c).deleteSession('a');

      final AiHomePageState s = read(c);
      expect(s.sessions.containsKey('a'), isFalse);
      expect(s.currentId, 'b');
      expect(repo.deletedIds, <String>['a']);
    });

    test('deleteSession 策略记录不存在时按普通会话删除', () async {
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session('a', deployedTo: 'missing-live'),
        _session('b'),
      ]);
      final ProviderContainer c = makeContainer(repo);
      pin(c);
      await ctrl(c).loadSessions();
      await ctrl(c).deleteSession('a');

      final AiHomePageState s = read(c);
      expect(s.sessions.containsKey('a'), isFalse);
      expect(s.currentId, 'b');
      expect(repo.deletedIds, <String>['a']);
    });

    test('deleteSession 策略状态查询失败时阻止删除', () async {
      final _FakeAiChatRepository repo = _FakeAiChatRepository(<AiSession>[
        _session('a', deployedTo: 'live-a'),
      ]);
      final _FakeLiveStrategyRepository liveRepo = _FakeLiveStrategyRepository(
        <String, LiveStrategy>{
          'live-a': _liveStrategy('live-a', LiveStrategyStatus.running),
        },
      )..getStrategyError = const ApiException(message: 'timeout');
      final ProviderContainer c = makeContainer(repo, liveRepo: liveRepo);
      pin(c);
      await ctrl(c).loadSessions();

      await expectLater(
        ctrl(c).deleteSession('a'),
        throwsA(
          isA<AiSessionDeleteBlockedException>().having(
            (AiSessionDeleteBlockedException e) => e.reason,
            'reason',
            AiSessionDeleteBlockReason.unknownStrategyState,
          ),
        ),
      );
      expect(read(c).sessions.containsKey('a'), isTrue);
      expect(repo.deletedIds, isEmpty);
    });

    test('createSession 切到新会话并清理新会话草稿和发送态', () {
      fakeAsync((FakeAsync async) {
        final ProviderContainer c = makeContainer(
          _FakeAiChatRepository(<AiSession>[_session('a')])
            ..replyContent = 'streaming',
        );
        pin(c);
        ctrl(c).loadSessions();
        async.flushMicrotasks();
        ctrl(c).persistDraft('old draft');
        ctrl(c).send('hello');
        async.flushMicrotasks();
        expect(read(c).isSending, isFalse);

        ctrl(c).createSession('新方案');
        async.flushMicrotasks();

        final AiHomePageState s = read(c);
        expect(s.currentId, 'new-1');
        expect(s.order.first, 'new-1');
        expect(s.drafts['new-1'], isNull);
        expect(s.drafts['a'], '');
        expect(s.isThinking, isFalse);
      });
    });
  });
}
