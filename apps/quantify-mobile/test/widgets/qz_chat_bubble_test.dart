import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_chat_bubble.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('user bubble renders without overflow across 9 themes',
      (WidgetTester tester) async {
    await verifyAllThemes(
      tester,
      () => QzChatBubble(
        role: QzChatRole.user,
        content: '帮我做一个 BTC 趋势策略',
        time: DateTime.fromMillisecondsSinceEpoch(1_716_000_000_000),
      ),
      (WidgetTester t) async {
        expect(find.text('帮我做一个 BTC 趋势策略'), findsOneWidget);
      },
    );
  });

  testWidgets('assistant bubble renders without overflow across 9 themes',
      (WidgetTester tester) async {
    await verifyAllThemes(
      tester,
      () => const QzChatBubble(
        role: QzChatRole.assistant,
        content: '好的，基于 EMA20/60 的趋势策略已生成。',
      ),
      (WidgetTester t) async {
        expect(find.text('好的，基于 EMA20/60 的趋势策略已生成。'), findsOneWidget);
        // #1589: assistant 必须带左侧 bot avatar。
        expect(
          find.byKey(const Key('ai-bubble-bot-avatar')),
          findsOneWidget,
        );
      },
    );
  });

  testWidgets('user bubble does not render bot avatar',
      (WidgetTester tester) async {
    await verifyAllThemes(
      tester,
      () => const QzChatBubble(
        role: QzChatRole.user,
        content: 'ping',
      ),
      (WidgetTester t) async {
        expect(
          find.byKey(const Key('ai-bubble-bot-avatar')),
          findsNothing,
        );
      },
    );
  });

  testWidgets('assistant bubble with codeBlock renders across 9 themes',
      (WidgetTester tester) async {
    await verifyAllThemes(
      tester,
      () => const QzChatBubble(
        role: QzChatRole.assistant,
        content: '示例:',
        codeBlock: 'if (ema20 > ema60) buy();',
      ),
      (WidgetTester t) async {
        expect(find.text('if (ema20 > ema60) buy();'), findsOneWidget);
      },
    );
  });
}
