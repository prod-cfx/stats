import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/pages/ai/widgets/qz_chat_bubble.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('user bubble renders without overflow across 9 themes', (
    WidgetTester tester,
  ) async {
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

  testWidgets('assistant bubble renders without overflow across 9 themes', (
    WidgetTester tester,
  ) async {
    await verifyAllThemes(
      tester,
      () => const QzChatBubble(
        role: QzChatRole.assistant,
        content: '好的，基于 EMA20/60 的趋势策略已生成。',
      ),
      (WidgetTester t) async {
        expect(find.text('好的，基于 EMA20/60 的趋势策略已生成。'), findsOneWidget);
        // #1589: assistant 必须带左侧 bot avatar。
        expect(find.byKey(const Key('ai-bubble-bot-avatar')), findsOneWidget);
      },
    );
  });

  testWidgets('user bubble does not render bot avatar', (
    WidgetTester tester,
  ) async {
    await verifyAllThemes(
      tester,
      () => const QzChatBubble(role: QzChatRole.user, content: 'ping'),
      (WidgetTester t) async {
        expect(find.byKey(const Key('ai-bubble-bot-avatar')), findsNothing);
      },
    );
  });

  testWidgets('assistant bubble with codeBlock renders across 9 themes', (
    WidgetTester tester,
  ) async {
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

  testWidgets(
    'params bubble renders category chip + identification话术 + confirm CTA',
    (WidgetTester tester) async {
      int confirmed = 0;
      await verifyAllThemes(
        tester,
        () => QzChatBubble(
          role: QzChatRole.assistant,
          content: '参数如下:',
          params: const <String, String>{'category': '趋势跟踪', 'fast_ma': '5'},
          onConfirm: () => confirmed++,
        ),
        // 参数卡 + Chip + 识别话术 + CTA 整体高度超过默认 120 缩略图高度，
        // 真实场景在可滚动 ListView 内不溢出；测试放宽画布高度复现真实布局。
        surfaceSize: const Size(360, 360),
        (WidgetTester t) async {
          // 分类 badge：「已为你识别为」+ 分类 chip +「类策略，建议参数：」
          // （#1831 验收 1 / #1897 文案对齐）。
          expect(
            find.byKey(const Key('ai-bubble-category-chip')),
            findsOneWidget,
          );
          expect(find.text('趋势跟踪'), findsOneWidget);
          expect(find.text('已为你识别为'), findsOneWidget);
          expect(find.text('类策略，建议参数：'), findsOneWidget);
          // 「需要我开始回测吗?」+「确认策略」CTA（#1831 验收 2）。
          expect(find.text('需要我开始回测吗?'), findsOneWidget);
          expect(find.text('确认策略'), findsOneWidget);
        },
      );
      // 点击 CTA 触发 onConfirm（单次校验即可，避免跨 9 主题重复累加干扰断言）。
      await tester.tap(find.byKey(const Key('ai-bubble-confirm-cta')).first);
      await tester.pump();
      expect(confirmed, greaterThan(0));
    },
  );

  testWidgets(
    'deployed bubble renders ✓ header + 策略 ID 运行中 + 归档话术 + 查看实盘 CTA',
    (WidgetTester tester) async {
      int viewed = 0;
      await verifyAllThemes(
        tester,
        () => QzChatBubble(
          role: QzChatRole.system,
          content: '策略已部署到 BINANCE',
          deployedExchange: 'BINANCE',
          deployedInstanceId: 'QF-AY7K2P',
          onViewLive: () => viewed++,
        ),
        // 富气泡含头部块 + 归档话术 + CTA，整体超过缩略图默认高度。
        surfaceSize: const Size(360, 360),
        (WidgetTester t) async {
          // #1833 验收 1：富气泡 + 实例 ID + 运行中状态 + 归档话术。
          expect(find.byKey(const Key('ai-bubble-deployed')), findsOneWidget);
          expect(find.text('策略已部署到 BINANCE'), findsOneWidget);
          expect(find.text('策略 ID QF-AY7K2P · 当前运行中'), findsOneWidget);
          expect(find.text('这条对话已归档，后续调整请新建方案或在实盘策略中操作。'), findsOneWidget);
          // #1833 验收 2：气泡内「查看实盘策略」CTA。
          expect(find.byKey(const Key('ai-bubble-view-live')), findsOneWidget);
          expect(find.text('查看实盘策略'), findsOneWidget);
          // 部署终态仍是 assistant 气泡，左侧保留设计稿 bot avatar。
          expect(find.byKey(const Key('ai-bubble-bot-avatar')), findsOneWidget);
        },
      );
      // 点击 CTA 触发 onViewLive（单次校验，避免跨 9 主题累加干扰）。
      await tester.tap(find.byKey(const Key('ai-bubble-view-live')).first);
      await tester.pump();
      expect(viewed, greaterThan(0));
    },
  );

  testWidgets('params bubble without onConfirm renders no CTA', (
    WidgetTester tester,
  ) async {
    await verifyAllThemes(
      tester,
      () => const QzChatBubble(
        role: QzChatRole.assistant,
        content: '参数如下:',
        params: <String, String>{'fast_ma': '5'},
      ),
      (WidgetTester t) async {
        expect(find.byKey(const Key('ai-bubble-confirm-cta')), findsNothing);
        // 无 category 时不渲染 Chip。
        expect(find.byKey(const Key('ai-bubble-category-chip')), findsNothing);
      },
    );
  });

  // #1834 验收 1：已部署（locked）会话参数卡顶部显示锁定横幅。
  testWidgets('locked params bubble shows LockedBanner atop the card', (
    WidgetTester tester,
  ) async {
    await verifyAllThemes(
      tester,
      () => QzChatBubble(
        role: QzChatRole.assistant,
        content: '参数如下:',
        params: const <String, String>{'category': '趋势跟踪', 'fast_ma': '5'},
        onConfirm: () {},
        locked: true,
      ),
      surfaceSize: const Size(360, 360),
      (WidgetTester t) async {
        expect(
          find.byKey(const Key('ai-bubble-locked-banner')),
          findsOneWidget,
        );
        expect(find.text('已归档 · 仅供查看'), findsOneWidget);
      },
    );
  });

  // #1834 验收 2：锁定态下隐藏「确认策略」CTA（即便 onConfirm 已注入）。
  testWidgets('locked params bubble hides the confirm CTA', (
    WidgetTester tester,
  ) async {
    await verifyAllThemes(
      tester,
      () => QzChatBubble(
        role: QzChatRole.assistant,
        content: '参数如下:',
        params: const <String, String>{'fast_ma': '5'},
        onConfirm: () {},
        locked: true,
      ),
      surfaceSize: const Size(360, 360),
      (WidgetTester t) async {
        expect(find.byKey(const Key('ai-bubble-confirm-cta')), findsNothing);
        expect(find.text('需要我开始回测吗?'), findsNothing);
      },
    );
  });

  // #1834 验收 3：未部署（locked=false，默认）会话行为不变——无横幅、CTA 正常。
  testWidgets('unlocked params bubble keeps CTA and shows no banner', (
    WidgetTester tester,
  ) async {
    await verifyAllThemes(
      tester,
      () => QzChatBubble(
        role: QzChatRole.assistant,
        content: '参数如下:',
        params: const <String, String>{'fast_ma': '5'},
        onConfirm: () {},
      ),
      surfaceSize: const Size(360, 360),
      (WidgetTester t) async {
        expect(find.byKey(const Key('ai-bubble-locked-banner')), findsNothing);
        expect(find.byKey(const Key('ai-bubble-confirm-cta')), findsOneWidget);
      },
    );
  });
}
