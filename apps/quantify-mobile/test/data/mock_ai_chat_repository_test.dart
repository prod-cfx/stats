import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_ai_chat_repository.dart';
import 'package:quantify_mobile/data/models/ai_chat_models.dart';

void main() {
  group('MockAiChatRepository', () {
    test('listSessions 返回至少 3 条 mock 会话（按 updatedAt 倒序）', () async {
      final MockAiChatRepository repo = MockAiChatRepository();
      final List<AiSession> list = await repo.listSessions();
      expect(list.length, greaterThanOrEqualTo(3));
      // 倒序断言：相邻两条 updatedAt 单调不递增。
      for (int i = 1; i < list.length; i++) {
        expect(
          list[i - 1].updatedAt.isBefore(list[i].updatedAt),
          isFalse,
        );
      }
    });

    test('createSession 在头部插入新会话（标题可空 → 走默认）', () async {
      final MockAiChatRepository repo = MockAiChatRepository();
      final AiSession s = await repo.createSession();
      expect(s.title, isNotEmpty);
      expect(s.category, '未分类');
      expect(s.messages, isNotEmpty); // 携带欢迎语
      final List<AiSession> after = await repo.listSessions();
      expect(after.any((AiSession x) => x.id == s.id), isTrue);
    });

    test('deleteSession 后该会话从列表消失', () async {
      final MockAiChatRepository repo = MockAiChatRepository();
      final AiSession s = await repo.createSession(title: 'tmp');
      await repo.deleteSession(s.id);
      final List<AiSession> after = await repo.listSessions();
      expect(after.any((AiSession x) => x.id == s.id), isFalse);
    });

    test('sendMessageTo 返回 assistant 回复并追加到对应 session', () async {
      final MockAiChatRepository repo = MockAiChatRepository();
      final List<AiSession> list = await repo.listSessions();
      final String id = list.first.id;
      final int before = list.first.messages.length;
      final ChatTurn reply = await repo.sendMessageTo(
        id,
        ChatTurn(
          id: 'u-1',
          role: 'user',
          content: '你好',
          timestamp: DateTime.fromMillisecondsSinceEpoch(0),
        ),
      );
      expect(reply.role, 'assistant');
      expect(reply.content, contains('你好'));
      final List<AiSession> after = await repo.listSessions();
      final AiSession updated =
          after.firstWhere((AiSession s) => s.id == id);
      expect(updated.messages.length, before + 2); // user + assistant
    });

    test('latestBacktest 返回 fixture 摘要', () async {
      final MockAiChatRepository repo = MockAiChatRepository();
      final BacktestSummary? s = await repo.latestBacktest('any');
      expect(s, isNotNull);
      expect(s!.id, 'bt-mock-1');
    });
  });
}
