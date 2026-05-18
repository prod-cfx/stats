import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_ai_chat_repository.dart';
import 'package:quantify_mobile/data/models/ai_chat_models.dart';

void main() {
  group('MockAiChatRepository', () {
    test('sendMessage 返回 assistant 回复', () async {
      final MockAiChatRepository repo = MockAiChatRepository();
      final ChatTurn reply = await repo.sendMessage(
        ChatTurn(
          id: 'u-1',
          role: 'user',
          content: '你好',
          timestamp: DateTime.fromMillisecondsSinceEpoch(0),
        ),
      );
      expect(reply.role, 'assistant');
      expect(reply.content, contains('你好'));
    });

    test('latestBacktest 返回 fixture 摘要', () async {
      final MockAiChatRepository repo = MockAiChatRepository();
      final BacktestSummary? s = await repo.latestBacktest('any');
      expect(s, isNotNull);
      expect(s!.id, 'bt-mock-1');
    });
  });
}
