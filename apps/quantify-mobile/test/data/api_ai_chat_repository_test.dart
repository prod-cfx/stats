import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_ai_chat_repository.dart';
import 'package:quantify_mobile/data/models/ai_chat_models.dart';
import 'package:quantify_mobile/data/services/account_services.dart';
import 'package:quantify_mobile/data/services/api_client.dart';

/// 用预置响应替身校验 [ApiAiChatRepository] 的异步 deploy 预埋
/// （deploy → 轮询 deploy-requests/{id}/result，上限 45 次）与 latestBacktest
/// unsupported 行为；不发真实 HTTP（issue #2285）。
class _StubAiChatService extends AiChatService {
  _StubAiChatService({
    required this.deployResults,
    this.deployError,
    this.deployResponse,
  }) : super(ApiClient(baseUrl: 'http://localhost'));

  /// 每次 getDeployResult 顺序返回；超出长度后复用最后一项。
  final List<Object?> deployResults;
  final Object? deployError;
  final Object? deployResponse;

  int deployCallCount = 0;
  int resultCallCount = 0;
  final List<Map<String, dynamic>> deployBodies = <Map<String, dynamic>>[];

  @override
  Future<dynamic> deployStrategy(Map<String, dynamic> body) async {
    deployCallCount++;
    deployBodies.add(body);
    final Object? error = deployError;
    if (error != null) throw error;
    return deployResponse ?? <String, dynamic>{'data': <String, dynamic>{}};
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
    this.conversationDetails = const <String, Map<String, dynamic>>{},
    this.createResponse,
    this.codegenSessions = const [],
    this.codegenError,
  }) : super(ApiClient(baseUrl: 'http://localhost'));

  final List<Map<String, dynamic>> rows;
  final Map<String, Map<String, dynamic>> conversationDetails;
  final Object? createResponse;
  final List<Map<String, dynamic>> codegenSessions;
  final Object? codegenError;
  final List<Object?> sendResponses = <Object?>[];
  final List<Map<String, dynamic>> createBodies = <Map<String, dynamic>>[];
  final List<Map<String, dynamic>> sendBodies = <Map<String, dynamic>>[];
  int listCallCount = 0;
  int detailCallCount = 0;
  int createCallCount = 0;
  int codegenCallCount = 0;
  int sendCallCount = 0;

  @override
  Future<dynamic> listSessions() async {
    listCallCount++;
    return rows;
  }

  @override
  Future<dynamic> getConversation(String conversationId) async {
    detailCallCount++;
    final Map<String, dynamic>? detail = conversationDetails[conversationId];
    if (detail == null) {
      throw ApiException(message: 'not found', statusCode: 404);
    }
    return <String, dynamic>{'data': detail};
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

Map<String, dynamic> _strategyDetail({
  String id = 'strategy-1',
  String name = 'BTCUSDT 15m AI策略',
  String status = 'running',
}) => <String, dynamic>{
  'id': id,
  'name': name,
  'status': status,
  'exchange': 'OKX',
  'symbol': 'BTCUSDT',
  'timeframe': '15m',
  'isSubscribed': true,
  'metrics': <String, dynamic>{},
  'updatedAt': '2026-06-17T02:35:00.000Z',
};

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

    test('front 后端会话恢复脚本和回测结果入口', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'cmq9u5ykn0bh9eaqs5rqt2o0r',
            'conversationTitle': '入场：15m k线里面 价格在e',
            'updatedAt': '2026-06-15T08:10:08.616Z',
            'activeCodegenSessionId': 'cmq9u5yka0bh3eaqsjnuvpn41',
            'status': 'PUBLISHED',
            'strategyInstanceId': 'cmqen7ul40p0flwqsr181f7ym',
            'canonicalDigest': 'sha256:872719e1',
            'scriptCode': 'export default function strategy() { return true; }',
            'publishedSnapshotId': 'cmqen7ulv0p0hlwqsgdtyptkm',
            'publishedSnapshotParamValues': <String, dynamic>{
              'symbol': 'BTCUSDT',
              'baseTimeframe': '15m',
              'marketType': 'perp',
            },
            'publishedSnapshotBacktestConfigDefaults': <String, dynamic>{
              'baseTimeframe': '15m',
              'symbol': 'BTCUSDT',
            },
            'conversationMessages': <Map<String, dynamic>>[
              <String, dynamic>{'role': 'assistant', 'content': '我整理出的策略逻辑如下。'},
              <String, dynamic>{'role': 'user', 'content': '确认策略'},
            ],
            'lastBacktestRef': <String, dynamic>{
              'jobId': 'btjob-1781511007550-ae332028',
              'publishedSnapshotId': 'cmqen7ulv0p0hlwqsgdtyptkm',
              'summary': <String, dynamic>{
                'maxDrawdownPct': 0.39,
                'totalReturnPct': -0.33,
                'winRatePct': 1.44,
                'tradeCount': 139,
                'openTradeCount': 1,
                'openPnl': 0.37,
                'marketType': 'perp',
              },
              'completedAt': '2026-06-15T08:10:08.616Z',
            },
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final AiSession session = (await repo.listSessions()).single;

      expect(session.id, 'cmq9u5ykn0bh9eaqs5rqt2o0r');
      expect(session.llmCodegenSessionId, 'cmq9u5yka0bh3eaqsjnuvpn41');
      expect(session.deployedTo, 'cmqen7ul40p0flwqsr181f7ym');
      final ChatTurn scriptReady = session.messages.firstWhere(
        (ChatTurn turn) => turn.kind == ChatTurnKind.scriptReady,
      );
      expect(
        scriptReady.strategyContext?.publishedSnapshotId,
        'cmqen7ulv0p0hlwqsgdtyptkm',
      );
      expect(scriptReady.strategyContext?.scriptCode, contains('strategy'));
      expect(scriptReady.strategyContext?.symbol, 'BTCUSDT');
      expect(
        scriptReady.strategyContext?.toDeploymentContext().strategyName,
        '入场：15m k线里面 价格在e',
      );

      final ChatTurn resultTurn = session.messages.firstWhere(
        (ChatTurn turn) => turn.kind == ChatTurnKind.result,
      );
      expect(resultTurn.backtestSummary?.id, 'btjob-1781511007550-ae332028');
      expect(resultTurn.backtestSummary?.totalReturnPercent, -0.33);
      expect(resultTurn.backtestSummary?.maxDrawdownPercent, 0.39);
      expect(resultTurn.backtestSummary?.trades, 139);
    });

    test('staging 会话用 strategyInstanceId 标记已部署实例', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'cmqhoiptw16w2kfqsm5zwei4p',
            'conversationTitle': '15min k线里面 价格在em',
            'updatedAt': '2026-06-17T08:53:02.518Z',
            'activeCodegenSessionId': 'cmqhoiptj16vykfqsgmfe5vf8',
            'status': 'PUBLISHED',
            'strategyInstanceId': 'cmqhok7ol19iukfqsalb7sjzi',
            'publishedSnapshotId': 'cmqhok7p919iykfqsk5tkddlh',
            'scriptCode': 'export default function strategy() {}',
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final AiSession session = (await repo.listSessions()).single;

      expect(session.deployedTo, 'cmqhok7ol19iukfqsalb7sjzi');
      expect(
        session.messages.any(
          (ChatTurn t) => t.kind == ChatTurnKind.scriptReady,
        ),
        isTrue,
      );
    });

    test('getSession 读取会话详情并恢复完整页面状态', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'conversation-1',
            'conversationTitle': '列表摘要',
            'updatedAt': '2026-06-15T08:00:00.000Z',
          },
        ],
        conversationDetails: <String, Map<String, dynamic>>{
          'conversation-1': <String, dynamic>{
            'id': 'conversation-1',
            'conversationTitle': '详情标题',
            'updatedAt': '2026-06-15T08:10:08.616Z',
            'activeCodegenSessionId': 'codegen-1',
            'status': 'PUBLISHED',
            'canonicalDigest': 'sha256:detail',
            'scriptCode': 'export default function strategy() { return true; }',
            'publishedSnapshotId': 'snapshot-1',
            'publishedSnapshotParamValues': <String, dynamic>{
              'symbol': 'ETHUSDT',
              'baseTimeframe': '5m',
            },
            'conversationMessages': <Map<String, dynamic>>[
              <String, dynamic>{'role': 'user', 'content': 'front 新建策略'},
              <String, dynamic>{'role': 'assistant', 'content': '策略逻辑如下'},
            ],
            'lastBacktestRef': <String, dynamic>{
              'jobId': 'btjob-detail-1',
              'summary': <String, dynamic>{
                'maxDrawdownPct': 1.2,
                'totalReturnPct': 3.4,
                'tradeCount': 8,
              },
            },
          },
        },
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final AiSession session = await repo.getSession('conversation-1');

      expect(svc.detailCallCount, 1);
      expect(session.title, '详情标题');
      expect(session.llmCodegenSessionId, 'codegen-1');
      expect(
        session.messages.any((ChatTurn turn) => turn.content == 'front 新建策略'),
        isTrue,
      );
      expect(
        session.messages
            .firstWhere(
              (ChatTurn turn) => turn.kind == ChatTurnKind.scriptReady,
            )
            .strategyContext
            ?.symbol,
        'ETHUSDT',
      );
      expect(
        session.messages
            .firstWhere((ChatTurn turn) => turn.kind == ChatTurnKind.result)
            .backtestSummary
            ?.id,
        'btjob-detail-1',
      );
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
    test('首次 pending（data:null）后真实策略详情 → 返回非空 session，'
        '轮询次数 ≤ 45', () async {
      final _StubAiChatService svc = _StubAiChatService(
        deployResults: <Object?>[
          <String, dynamic>{'data': null},
          <String, dynamic>{'data': _strategyDetail(id: 'live-1')},
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        deployPollInterval: Duration.zero,
      );

      final AiSession? s = await repo.markDeployed('sess-1', 'inst-1');

      expect(s, isNotNull);
      expect(s!.id, 'live-1');
      expect(s.title, 'BTCUSDT 15m AI策略');
      expect(s.deployedTo, 'live-1');
      expect(svc.resultCallCount, lessThanOrEqualTo(45));
      expect(svc.resultCallCount, 2);
    });

    test('deploy POST 直接返回真实策略详情 → 不轮询并返回成功 session', () async {
      final _StubAiChatService svc = _StubAiChatService(
        deployResponse: <String, dynamic>{
          'data': _strategyDetail(id: 'live-direct', name: '直返成功'),
        },
        deployResults: <Object?>[
          <String, dynamic>{'data': null},
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        deployPollInterval: Duration.zero,
      );

      final AiSession? s = await repo.markDeployed('sess-1', 'inst-1');

      expect(s, isNotNull);
      expect(s!.id, 'live-direct');
      expect(s.title, '直返成功');
      expect(s.deployedTo, 'live-direct');
      expect(svc.resultCallCount, 0);
    });

    test('返回 conversation 形状不会误判为部署成功', () async {
      final _StubAiChatService svc = _StubAiChatService(
        deployResults: <Object?>[
          <String, dynamic>{
            'data': <String, dynamic>{
              'id': 'conversation-1',
              'conversationTitle': '测试会话',
              'strategyInstanceId': null,
            },
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        deployPollInterval: Duration.zero,
      );

      final AiSession? s = await repo.markDeployed('sess-1', 'inst-1');

      expect(s, isNull);
      expect(svc.resultCallCount, 45);
    });

    test('恒 pending（data:null）→ 返回 null 且轮询恰 45 次（有界，不死循环）', () async {
      final _StubAiChatService svc = _StubAiChatService(
        deployResults: <Object?>[
          <String, dynamic>{'data': null},
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        deployPollInterval: Duration.zero,
      );

      final AiSession? s = await repo.markDeployed('sess-1', 'inst-1');

      expect(s, isNull);
      expect(svc.resultCallCount, 45);
    });

    test('同一 (sessionId,instanceId) 两次调用 → deployRequestId 一致'
        '（幂等键确定性）', () async {
      final _StubAiChatService svc = _StubAiChatService(
        deployResults: <Object?>[
          <String, dynamic>{'data': null},
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        deployPollInterval: Duration.zero,
      );

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
        final ApiAiChatRepository repo = ApiAiChatRepository(
          svc,
          deployPollInterval: Duration.zero,
        );

        await repo.markDeployed(
          'sess-A',
          'inst-B',
          strategyName: 'BTCUSDT 15m AI策略',
          exchangeAccountId: 'acct-1',
          exchangeAccountName: 'OKX 主账户',
        );

        final Map<String, dynamic> body = svc.deployBodies.single;
        expect(body['deployRequestId'], isNotNull);
        expect(body['publishedSnapshotId'], 'inst-B');
        expect(body['exchangeAccountId'], 'acct-1');
        expect(body['exchangeAccountName'], 'OKX 主账户');
        expect(body['name'], 'BTCUSDT 15m AI策略');
      },
    );

    test('strategyName 为空时 deploy name 用 front 默认名而不是 snapshot id', () async {
      final _StubAiChatService svc = _StubAiChatService(
        deployResults: <Object?>[
          <String, dynamic>{'data': null},
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        deployPollInterval: Duration.zero,
      );

      await repo.markDeployed('sess-A', 'cmqen7ulv0p0hlwqsgdtyptkm');

      final Map<String, dynamic> body = svc.deployBodies.single;
      expect(body['publishedSnapshotId'], 'cmqen7ulv0p0hlwqsgdtyptkm');
      expect(body['name'], 'AI Strategy');
    });

    test('deploy POST 超时后用同一 deployRequestId 对账成功', () async {
      final _StubAiChatService svc = _StubAiChatService(
        deployError: const ApiException(message: 'The request took longer'),
        deployResults: <Object?>[
          <String, dynamic>{'data': null},
          <String, dynamic>{
            'data': _strategyDetail(id: 'live-timeout', name: '对账成功'),
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(
        svc,
        deployPollInterval: Duration.zero,
      );

      final AiSession? s = await repo.markDeployed(
        'sess-timeout',
        'snap-timeout',
        strategyName: 'BTCUSDT 15m AI策略',
      );

      expect(s, isNotNull);
      expect(s!.id, 'live-timeout');
      expect(s.title, '对账成功');
      expect(s.deployedTo, 'live-timeout');
      expect(svc.deployBodies.single['name'], 'BTCUSDT 15m AI策略');
      expect(svc.resultCallCount, 2);
    });
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
