import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_ai_chat_repository.dart';
import 'package:quantify_mobile/data/models/ai_chat_models.dart';
import 'package:quantify_mobile/data/services/account_services.dart';
import 'package:quantify_mobile/data/services/api_client.dart';

/// 用预置响应替身校验 [ApiAiChatRepository] 的异步 deploy 预埋
/// （deploy → 轮询 deploy-requests/{id}/result，上限 3 次）与 latestBacktest
/// unsupported 行为；不发真实 HTTP（issue #2285）。
class _StubAiChatService extends AiChatService {
  _StubAiChatService({required this.deployResults})
    : super(ApiClient(baseUrl: 'http://localhost'));

  /// 每次 getDeployResult 顺序返回；超出长度后复用最后一项。
  final List<Object?> deployResults;

  int deployCallCount = 0;
  int resultCallCount = 0;
  final List<Map<String, dynamic>> deployBodies = <Map<String, dynamic>>[];

  @override
  Future<dynamic> deployStrategy(Map<String, dynamic> body) async {
    deployCallCount++;
    deployBodies.add(body);
    return <String, dynamic>{'data': <String, dynamic>{}};
  }

  @override
  Future<dynamic> getDeployResult(String deployRequestId) async {
    final Object? r =
        deployResults[resultCallCount < deployResults.length
            ? resultCallCount
            : deployResults.length - 1];
    resultCallCount++;
    return r;
  }
}

/// 替身：仅预置 listSessions 响应，校验 watchSession 从 list 真源派生
/// （契约无单会话 GET）；不发真实 HTTP（issue #2287）。
class _StubListAiChatService extends AiChatService {
  _StubListAiChatService({
    required this.rows,
    this.codegenSessions = const [],
    this.codegenError,
  }) : super(ApiClient(baseUrl: 'http://localhost'));

  final List<Map<String, dynamic>> rows;
  final List<Map<String, dynamic>> codegenSessions;
  final Object? codegenError;
  int listCallCount = 0;
  int codegenCallCount = 0;

  @override
  Future<dynamic> listSessions() async {
    listCallCount++;
    return rows;
  }

  @override
  Future<dynamic> getCodegenSession(String sessionId) async {
    final Object? error = codegenError;
    if (error != null) throw error;
    final Map<String, dynamic> r =
        codegenSessions[codegenCallCount < codegenSessions.length
            ? codegenCallCount
            : codegenSessions.length - 1];
    codegenCallCount++;
    return r;
  }
}

void main() {
  group('ApiAiChatRepository.watchSession 轮询真实 codegen session', () {
    test('轮询 codegen session，产出新增 assistant 消息后结束', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: const <Map<String, dynamic>>[],
        codegenSessions: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 's-1',
            'status': 'GENERATING',
            'conversationMessages': <Map<String, dynamic>>[
              <String, dynamic>{'role': 'user', 'content': '早'},
            ],
          },
          <String, dynamic>{
            'id': 's-1',
            'status': 'PUBLISHED',
            'conversationMessages': <Map<String, dynamic>>[
              <String, dynamic>{'role': 'user', 'content': '早'},
              <String, dynamic>{'role': 'assistant', 'content': '完成'},
            ],
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        sessionPollInterval: Duration.zero,
      );

      final List<ChatTurn> turns = await repo.watchSession('s-1').toList();

      expect(svc.codegenCallCount, 2);
      expect(turns, hasLength(1));
      expect(turns.single.role, 'assistant');
      expect(turns.single.content, '完成');
    });

    test('持续轮询直到终态，不因固定 3 次上限漏掉第 4 轮 assistant 消息', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: const <Map<String, dynamic>>[],
        codegenSessions: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 's-1',
            'status': 'GENERATING',
            'conversationMessages': <Map<String, dynamic>>[],
          },
          <String, dynamic>{
            'id': 's-1',
            'status': 'GENERATING',
            'conversationMessages': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'a-1',
                'role': 'assistant',
                'content': '一',
              },
            ],
          },
          <String, dynamic>{
            'id': 's-1',
            'status': 'GENERATING',
            'conversationMessages': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'a-1',
                'role': 'assistant',
                'content': '一',
              },
              <String, dynamic>{
                'id': 'a-2',
                'role': 'assistant',
                'content': '二',
              },
            ],
          },
          <String, dynamic>{
            'id': 's-1',
            'status': 'PUBLISHED',
            'conversationMessages': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'a-1',
                'role': 'assistant',
                'content': '一',
              },
              <String, dynamic>{
                'id': 'a-2',
                'role': 'assistant',
                'content': '二',
              },
              <String, dynamic>{
                'id': 'a-3',
                'role': 'assistant',
                'content': '三',
              },
            ],
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        sessionPollInterval: Duration.zero,
      );

      final List<ChatTurn> turns = await repo.watchSession('s-1').toList();

      expect(svc.codegenCallCount, 4);
      expect(turns.map((ChatTurn t) => t.content), <String>['一', '二', '三']);
    });

    test('后端错误通过 stream error 传播，不回退吞错', () async {
      final StateError error = StateError('codegen unavailable');
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: const <Map<String, dynamic>>[],
        codegenError: error,
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        sessionPollInterval: Duration.zero,
      );

      await expectLater(repo.watchSession('s-1'), emitsError(same(error)));
      expect(svc.listCallCount, 0);
    });

    test('取消订阅后停止继续轮询', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: const <Map<String, dynamic>>[],
        codegenSessions: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 's-1',
            'status': 'GENERATING',
            'conversationMessages': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'a-1',
                'role': 'assistant',
                'content': '一',
              },
            ],
          },
          <String, dynamic>{
            'id': 's-1',
            'status': 'GENERATING',
            'conversationMessages': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'a-1',
                'role': 'assistant',
                'content': '一',
              },
              <String, dynamic>{
                'id': 'a-2',
                'role': 'assistant',
                'content': '二',
              },
            ],
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        sessionPollInterval: Duration.zero,
      );

      final List<ChatTurn> turns = await repo
          .watchSession('s-1')
          .take(1)
          .toList();

      expect(turns.single.content, '一');
      expect(svc.codegenCallCount, 1);
    });

    test('命中会话但无消息 → 不发任何帧', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: const <Map<String, dynamic>>[],
        codegenSessions: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 's-1',
            'status': 'PUBLISHED',
            'title': '空会话',
            'conversationMessages': <Map<String, dynamic>>[],
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        sessionPollInterval: Duration.zero,
      );

      final List<ChatTurn> turns = await repo.watchSession('s-1').toList();

      expect(turns, isEmpty);
    });

    test('未命中会话 → 静默结束（不抛、不发帧）', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: const <Map<String, dynamic>>[],
        codegenSessions: <Map<String, dynamic>>[
          <String, dynamic>{'id': 's-1', 'status': 'PUBLISHED', 'title': '会话1'},
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        sessionPollInterval: Duration.zero,
      );

      final List<ChatTurn> turns = await repo.watchSession('missing').toList();

      expect(turns, isEmpty);
    });

    test('list 为空 → 静默结束', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: <Map<String, dynamic>>[],
        codegenSessions: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 's-1',
            'status': 'PUBLISHED',
            'conversationMessages': <Map<String, dynamic>>[],
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        sessionPollInterval: Duration.zero,
      );

      final List<ChatTurn> turns = await repo.watchSession('s-1').toList();

      expect(turns, isEmpty);
    });
  });

  group('ApiAiChatRepository.markDeployed 异步两段预埋', () {
    test('首次 pending（data:null）后成功（data:{...}）→ 返回非空 session，'
        '轮询次数 ≤ 3', () async {
      final _StubAiChatService svc = _StubAiChatService(
        deployResults: <Object?>[
          <String, dynamic>{'data': null},
          <String, dynamic>{
            'data': <String, dynamic>{'id': 's-1', 'title': '已部署'},
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final AiSession? s = await repo.markDeployed('sess-1', 'inst-1');

      expect(s, isNotNull);
      expect(s!.id, 's-1');
      expect(s.title, '已部署');
      expect(svc.resultCallCount, lessThanOrEqualTo(3));
      expect(svc.resultCallCount, 2);
    });

    test('恒 pending（data:null）→ 返回 null 且轮询恰 3 次（有界，不死循环）', () async {
      final _StubAiChatService svc = _StubAiChatService(
        deployResults: <Object?>[
          <String, dynamic>{'data': null},
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final AiSession? s = await repo.markDeployed('sess-1', 'inst-1');

      expect(s, isNull);
      expect(svc.resultCallCount, 3);
    });

    test('同一 (sessionId,instanceId) 两次调用 → deployRequestId 一致'
        '（幂等键确定性）', () async {
      final _StubAiChatService svc = _StubAiChatService(
        deployResults: <Object?>[
          <String, dynamic>{'data': null},
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      await repo.markDeployed('sess-X', 'inst-Y');
      await repo.markDeployed('sess-X', 'inst-Y');

      expect(svc.deployBodies.length, 2);
      final Object? id0 = svc.deployBodies[0]['deployRequestId'];
      final Object? id1 = svc.deployBodies[1]['deployRequestId'];
      expect(id0, isNotNull);
      expect(id0, id1);
    });

    test(
      'deploy body 含 deployRequestId / publishedSnapshotId / name',
      () async {
        final _StubAiChatService svc = _StubAiChatService(
          deployResults: <Object?>[
            <String, dynamic>{'data': null},
          ],
        );
        final ApiAiChatRepository repo = ApiAiChatRepository(svc);

        await repo.markDeployed(
          'sess-A',
          'inst-B',
          exchangeAccountId: 'acct-1',
          exchangeAccountName: 'OKX 主账户',
        );

        final Map<String, dynamic> body = svc.deployBodies.single;
        expect(body['deployRequestId'], isNotNull);
        expect(body['publishedSnapshotId'], 'inst-B');
        expect(body['exchangeAccountId'], 'acct-1');
        expect(body['exchangeAccountName'], 'OKX 主账户');
        expect(body.containsKey('name'), isTrue);
      },
    );
  });

  group('ApiAiChatRepository.latestBacktest 读取真实 lastBacktestRef', () {
    test('从 conversation list 的 lastBacktestRef.summary 解析摘要', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'conv-1',
            'lastBacktestRef': <String, dynamic>{
              'jobId': 'job-1',
              'summary': <String, dynamic>{
                'totalReturnPct': 12.5,
                'maxDrawdownPct': 3.4,
                'tradeCount': 9,
              },
            },
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final BacktestSummary? r = await repo.latestBacktest('conv-1');

      expect(r, isNotNull);
      expect(r!.id, 'job-1');
      expect(r.totalReturnPercent, 12.5);
      expect(r.maxDrawdownPercent, 3.4);
      expect(r.trades, 9);
      expect(svc.listCallCount, 1);
    });
  });
}
