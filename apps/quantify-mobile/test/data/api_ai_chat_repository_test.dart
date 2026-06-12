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
    this.createResponse,
    this.codegenSessions = const [],
    this.codegenError,
  }) : super(ApiClient(baseUrl: 'http://localhost'));

  final List<Map<String, dynamic>> rows;
  final Object? createResponse;
  final List<Map<String, dynamic>> codegenSessions;
  final Object? codegenError;
  final List<Object?> sendResponses = <Object?>[];
  final List<Map<String, dynamic>> createBodies = <Map<String, dynamic>>[];
  final List<Map<String, dynamic>> sendBodies = <Map<String, dynamic>>[];
  int listCallCount = 0;
  int createCallCount = 0;
  int codegenCallCount = 0;
  int sendCallCount = 0;

  @override
  Future<dynamic> listSessions() async {
    listCallCount++;
    return rows;
  }

  @override
  Future<dynamic> createSession({String? title}) async {
    createCallCount++;
    createBodies.add(<String, dynamic>{'title': title});
    return createResponse ??
        <String, dynamic>{
          'data': <String, dynamic>{'id': 'created-1', 'status': 'DRAFTING'},
        };
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

  @override
  Future<dynamic> sendMessage(
    String sessionId,
    Map<String, dynamic> turn,
  ) async {
    sendCallCount++;
    sendBodies.add(turn);
    if (sendResponses.isEmpty) return <String, dynamic>{};
    return sendResponses.removeAt(0);
  }
}

void main() {
  group('ApiAiChatRepository.listSessions 会话 metadata', () {
    test('读取 activeCodegenSessionId 作为确认策略 codegen session', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'conversation-1',
            'conversationTitle': 'BTC 策略',
            'category': 'AI 量化',
            'updatedAt': '2026-06-10T22:42:00.000Z',
            'activeCodegenSessionId': 'codegen-active-1',
            'canonicalDigest': 'sha256:active-1',
            'conversationMessages': <Map<String, dynamic>>[
              <String, dynamic>{'role': 'assistant', 'content': '确认策略'},
            ],
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final List<AiSession> sessions = await repo.listSessions();

      expect(sessions.single.llmCodegenSessionId, 'codegen-active-1');
      expect(sessions.single.pendingCanonicalDigest, 'sha256:active-1');
    });
  });

  group('ApiAiChatRepository codegen raw response', () {
    test('createSession 支持后端 data 信封并生成新 codegen 会话', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: const <Map<String, dynamic>>[],
        createResponse: <String, dynamic>{
          'data': <String, dynamic>{
            'id': 'session-new',
            'status': 'DRAFTING',
            'assistantPrompt': '请补充策略规则。',
          },
          'message': 'Success',
        },
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final AiSession session = await repo.createSession(title: '新策略');

      expect(svc.createCallCount, 1);
      expect(session.id, 'session-new');
      expect(session.llmCodegenSessionId, 'session-new');
      expect(session.messages.single.codegenSessionId, 'session-new');
      expect(session.messages.single.content, '请补充策略规则。');
    });

    test('getCodegenSession 支持 data 信封并保留快照参数', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: const <Map<String, dynamic>>[],
        codegenSessions: <Map<String, dynamic>>[
          <String, dynamic>{
            'data': <String, dynamic>{
              'id': 'session-1',
              'status': 'CONFIRM_GATE',
              'canonicalDigest': 'sha256:canonical-1',
              'specDesc': <String, dynamic>{'symbol': 'BTC/USDT'},
            },
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final session = await repo.getCodegenSession('session-1');

      expect(session.id, 'session-1');
      expect(session.status.name, 'CONFIRM_GATE');
      expect(session.canonicalDigest, 'sha256:canonical-1');
      expect(session.specDesc?['symbol']?.value, 'BTC/USDT');
    });

    test('getCodegenSession 忽略 JSON object 内 null 字段', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: const <Map<String, dynamic>>[],
        codegenSessions: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'session-nullable',
            'status': 'CONFIRM_GATE',
            'publicationGate': null,
            'specDesc': <String, dynamic>{
              'symbol': 'BTC/USDT',
              'optional': null,
              'rules': <Object?>[
                <String, Object?>{'key': 'ma.cross', 'value': null},
                null,
              ],
            },
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final session = await repo.getCodegenSession('session-nullable');

      expect(session.id, 'session-nullable');
      expect(session.specDesc?['symbol']?.value, 'BTC/USDT');
      expect(session.specDesc?.containsKey('optional'), isFalse);
      final Object? rules = session.specDesc?['rules']?.value;
      expect(rules, isA<List<Object?>>());
      expect(rules as List<Object?>, hasLength(1));
      expect(
        (rules.single as Map<String, Object?>).containsKey('value'),
        isFalse,
      );
    });

    test('getCodegenSession 缺少 id 时抛中文业务错误', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: const <Map<String, dynamic>>[],
        codegenSessions: <Map<String, dynamic>>[
          <String, dynamic>{
            'data': <String, dynamic>{'status': 'DRAFTING'},
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      expect(
        () => repo.getCodegenSession('session-1'),
        throwsA(
          isA<ApiException>().having(
            (ApiException e) => e.message,
            'message',
            '策略生成会话暂不可用，请返回 AI 对话重新发送策略。',
          ),
        ),
      );
    });

    test('sendMessageTo 走真实 codegen body 并支持 data 信封', () async {
      final _StubListAiChatService svc =
          _StubListAiChatService(rows: const <Map<String, dynamic>>[])
            ..sendResponses.add(<String, dynamic>{
              'data': <String, dynamic>{
                'id': 'session-1',
                'status': 'CONFIRM_GATE',
                'assistantPrompt': '请确认策略。',
              },
            });
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final ChatTurn turn = await repo.sendMessageTo(
        'session-1',
        ChatTurn(
          id: 'u-1',
          role: 'user',
          content: 'EMA 策略',
          timestamp: DateTime(2026),
        ),
      );

      expect(turn.codegenSessionId, 'session-1');
      expect(turn.content, '请确认策略。');
      expect(svc.sendBodies.single['message'], 'EMA 策略');
      expect(svc.sendBodies.single['locale'], 'zh');
      expect(svc.sendBodies.single['confirmGenerate'], isFalse);
      expect(svc.sendBodies.single.containsKey('content'), isFalse);
    });

    test('CONFIRM_GATE 不把 raw specDesc 渲染为聊天参数块', () async {
      final _StubListAiChatService svc =
          _StubListAiChatService(rows: const <Map<String, dynamic>>[])
            ..sendResponses.add(<String, dynamic>{
              'data': <String, dynamic>{
                'id': 'session-1',
                'status': 'CONFIRM_GATE',
                'canonicalDigest': 'sha256:canonical-1',
                'assistantPrompt': '请确认是否按这个逻辑生成脚本。',
                'publishedSnapshotParamValues': <String, dynamic>{
                  'viewType': 'semantic_snapshot',
                  'canonicalDigest': 'sha256:canonical-1',
                  'version': 1,
                  'confirmation': 'pending',
                  'ruleSummary': '均线策略',
                },
                'specDesc': <String, dynamic>{
                  'viewType': 'semantic_snapshot',
                  'canonicalDigest': 'sha256:canonical-1',
                  'version': 1,
                  'confirmation': <String, dynamic>{
                    'digest': 'sha256:canonical-1',
                  },
                  'ruleSummary': <String, dynamic>{'title': '均线策略'},
                },
              },
            });
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final ChatTurn turn = await repo.sendMessageTo(
        'session-1',
        ChatTurn(
          id: 'u-1',
          role: 'user',
          content: '生成均线策略',
          timestamp: DateTime(2026),
        ),
      );

      expect(turn.kind, ChatTurnKind.text);
      expect(turn.params, isNull);
      expect(turn.content, '请确认是否按这个逻辑生成脚本。');
      expect(turn.content, isNot(contains('策略脚本已生成')));
      expect(turn.codegenSessionId, 'session-1');
      expect(turn.confirmedCanonicalDigest, 'sha256:canonical-1');
      expect(svc.sendBodies.single['confirmGenerate'], isFalse);
    });

    test('confirmStrategy 走 raw body 并支持 data 信封', () async {
      final _StubListAiChatService svc =
          _StubListAiChatService(rows: const <Map<String, dynamic>>[])
            ..sendResponses.add(<String, dynamic>{
              'data': <String, dynamic>{
                'id': 'session-1',
                'status': 'PUBLISHED',
                'publishedSnapshotId': 'snapshot-1',
              },
            });
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final session = await repo.confirmStrategy(
        'session-1',
        message: '确认策略',
        confirmedCanonicalDigest: ' sha256:canonical-1 ',
      );

      expect(session.id, 'session-1');
      expect(session.status.name, 'PUBLISHED');
      expect(session.publishedSnapshotId, 'snapshot-1');
      expect(svc.sendBodies.single['message'], '确认策略');
      expect(svc.sendBodies.single['locale'], 'zh');
      expect(svc.sendBodies.single['confirmGenerate'], isTrue);
      expect(
        svc.sendBodies.single['confirmedCanonicalDigest'],
        'sha256:canonical-1',
      );
    });
  });

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
