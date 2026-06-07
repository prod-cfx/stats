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
    final Object? r = deployResults[
        resultCallCount < deployResults.length
            ? resultCallCount
            : deployResults.length - 1];
    resultCallCount++;
    return r;
  }
}

/// 替身：仅预置 listSessions 响应，校验 watchSession 从 list 真源派生
/// （契约无单会话 GET）；不发真实 HTTP（issue #2287）。
class _StubListAiChatService extends AiChatService {
  _StubListAiChatService({required this.rows})
      : super(ApiClient(baseUrl: 'http://localhost'));

  final List<Map<String, dynamic>> rows;
  int listCallCount = 0;

  @override
  Future<dynamic> listSessions() async {
    listCallCount++;
    return rows;
  }
}

void main() {
  group('ApiAiChatRepository.watchSession 从 list 派生（契约无单会话 GET）', () {
    test('命中会话且有消息 → 发末条消息后结束', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 's-1',
            'title': '会话1',
            'messages': <Map<String, dynamic>>[
              <String, dynamic>{'id': 'm-1', 'role': 'user', 'content': '早'},
              <String, dynamic>{'id': 'm-2', 'role': 'assistant', 'content': '末条'},
            ],
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final List<ChatTurn> turns = await repo.watchSession('s-1').toList();

      expect(svc.listCallCount, 1);
      expect(turns, hasLength(1));
      expect(turns.single.id, 'm-2');
      expect(turns.single.content, '末条');
    });

    test('命中会话但无消息 → 不发任何帧', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 's-1',
            'title': '空会话',
            'messages': <Map<String, dynamic>>[],
          },
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final List<ChatTurn> turns = await repo.watchSession('s-1').toList();

      expect(turns, isEmpty);
    });

    test('未命中会话 → 静默结束（不抛、不发帧）', () async {
      final _StubListAiChatService svc = _StubListAiChatService(
        rows: <Map<String, dynamic>>[
          <String, dynamic>{'id': 's-1', 'title': '会话1'},
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final List<ChatTurn> turns =
          await repo.watchSession('missing').toList();

      expect(turns, isEmpty);
    });

    test('list 为空 → 静默结束', () async {
      final _StubListAiChatService svc =
          _StubListAiChatService(rows: <Map<String, dynamic>>[]);
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

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

    test('恒 pending（data:null）→ 返回 null 且轮询恰 3 次（有界，不死循环）',
        () async {
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

    test('deploy body 含 deployRequestId / publishedSnapshotId / name',
        () async {
      final _StubAiChatService svc = _StubAiChatService(
        deployResults: <Object?>[
          <String, dynamic>{'data': null},
        ],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      await repo.markDeployed('sess-A', 'inst-B');

      final Map<String, dynamic> body = svc.deployBodies.single;
      expect(body['deployRequestId'], isNotNull);
      expect(body['publishedSnapshotId'], 'inst-B');
      expect(body.containsKey('name'), isTrue);
    });
  });

  group('ApiAiChatRepository.latestBacktest unsupported', () {
    test('无条件返 null，不调用 service（service 方法已删，编译即保证）',
        () async {
      // service 仅需可构造；latestBacktest 不应触达任何 service 方法。
      final _StubAiChatService svc = _StubAiChatService(
        deployResults: <Object?>[<String, dynamic>{'data': null}],
      );
      final ApiAiChatRepository repo = ApiAiChatRepository(svc);

      final BacktestSummary? r = await repo.latestBacktest('any-session');

      expect(r, isNull);
      expect(svc.deployCallCount, 0);
      expect(svc.resultCallCount, 0);
    });
  });
}
