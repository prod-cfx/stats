import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/ai_chat_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/ai_chat_repository.dart';
import 'package:quantify_mobile/pages/ai/ai_home_page_controller.dart';
import 'package:quantify_mobile/pages/ai/ai_home_page_state.dart';

/// 可控的 fake AiChatRepository：会话内存映射 + 固定 reply，供 controller
/// 流转测试（无真实异步耗时，sendMessageTo 立即返回）。
class _FakeAiChatRepository implements AiChatRepository {
  _FakeAiChatRepository(this._seed);

  final List<AiSession> _seed;
  int _seq = 0;

  /// sendMessageTo 返回的固定回复内容（逐字流式铺设的源串）。
  String replyContent = 'hi';

  @override
  Future<List<AiSession>> listSessions() async => _seed;

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
  Future<void> deleteSession(String sessionId) async {}

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
  Stream<ChatTurn> watchSession(String sessionId) => const Stream<ChatTurn>.empty();

  @override
  Future<BacktestSummary?> latestBacktest(String sessionId) async => null;

  @override
  Future<AiSession?> markDeployed(String sessionId, String instanceId) async => null;
}

AiSession _session(String id, {List<ChatTurn>? messages}) => AiSession(
  id: id,
  title: 'S-$id',
  category: 'trend',
  updatedAt: DateTime(2026, 1, 1),
  messages: messages ?? const <ChatTurn>[],
);

void main() {
  ProviderContainer makeContainer(_FakeAiChatRepository repo) {
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        aiChatRepositoryProvider.overrideWithValue(repo),
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
      final ProviderContainer c = makeContainer(_FakeAiChatRepository(const []));
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
      pin(c);      await ctrl(c).loadSessions();
      final AiHomePageState s = read(c);
      expect(s.initialized, isTrue);
      expect(s.order, <String>['a', 'b']);
      expect(s.currentId, 'a');
    });

    test('send 全流转：thinking → streaming → done（逐字铺设完成）', () {
      fakeAsync((FakeAsync async) {
        final _FakeAiChatRepository repo =
            _FakeAiChatRepository(<AiSession>[_session('a')])
              ..replyContent = 'abc';
        final ProviderContainer c = makeContainer(repo);
        pin(c);

        ctrl(c).loadSessions();
        async.flushMicrotasks();
        expect(read(c).currentId, 'a');

        // 发送：第一个 await 之前同步置 thinking。
        ctrl(c).send('hello');
        expect(read(c).isThinking, isTrue);
        expect(read(c).isStreaming, isFalse);

        // reply 到达（fake 立即返回，微任务排空）：thinking 关、streaming 开。
        async.flushMicrotasks();
        expect(read(c).isThinking, isFalse);
        expect(read(c).isStreaming, isTrue);

        // 逐字流式：3 字符 × 250ms 后 streaming 关、内容铺满
        async.elapse(const Duration(milliseconds: 250 * 4));
        final AiHomePageState s = read(c);
        expect(s.isStreaming, isFalse);
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

        // 进入发送中后再次 send 被守卫
        ctrl(c).send('first');
        async.flushMicrotasks();
        ctrl(c).send('second');
        async.flushMicrotasks();
        final List<ChatTurn> userTurns = read(c)
            .sessions['a']!
            .messages
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
      pin(c);      await ctrl(c).loadSessions();
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
      pin(c);      await ctrl(c).loadSessions();
      expect(ctrl(c).switchSession('a'), isFalse);
      expect(ctrl(c).switchSession('b'), isTrue);
      expect(read(c).currentId, 'b');
    });

    test('deleteSession 删除当前会话切到下一条', () async {
      final ProviderContainer c = makeContainer(
        _FakeAiChatRepository(<AiSession>[_session('a'), _session('b')]),
      );
      pin(c);      await ctrl(c).loadSessions();
      await ctrl(c).deleteSession('a');
      final AiHomePageState s = read(c);
      expect(s.sessions.containsKey('a'), isFalse);
      expect(s.currentId, 'b');
    });
  });
}
