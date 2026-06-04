import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/ai_chat_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_ai_session_drawer.dart';

Future<void> _pump(
  WidgetTester tester,
  List<AiSession> sessions, {
  String? currentId,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 900));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(
        const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
      ),
      home: Scaffold(
        body: QzAiSessionDrawer(
          sessions: sessions,
          currentId: currentId,
          onSelect: (_) {},
          onCreate: () {},
          onDelete: (_) {},
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('会话项显示状态徽标、消息预览和更新时间（#2069）', (WidgetTester tester) async {
    final DateTime now = DateTime.now();
    await _pump(tester, <AiSession>[
      AiSession(
        id: 's-live',
        title: 'BTC 趋势 · 双均线',
        category: '趋势跟踪',
        cagrLabel: '+31.6%',
        updatedAt: now.subtract(const Duration(minutes: 5)),
        deployedTo: 'inst-1',
        messages: <ChatTurn>[
          ChatTurn(
            id: 'm1',
            role: 'assistant',
            content: '✓ 已部署 · 实盘运行中',
            timestamp: now,
          ),
        ],
      ),
      AiSession(
        id: 's-wip',
        title: 'SOL 网格 · 区间震荡',
        category: '网格',
        updatedAt: now,
        messages: <ChatTurn>[
          ChatTurn(
            id: 'm2',
            role: 'assistant',
            content: '已生成策略参数',
            timestamp: now,
          ),
        ],
      ),
    ], currentId: 's-live');

    expect(find.text('实盘'), findsOneWidget);
    expect(find.text('待部署'), findsOneWidget);
    expect(find.text('✓ 已部署 · 实盘运行中'), findsOneWidget);
    expect(find.text('已生成策略参数'), findsOneWidget);
    expect(find.text('+31.6%'), findsNothing);
    expect(find.text('5 分钟前'), findsOneWidget);
    expect(find.text('刚刚'), findsOneWidget);
  });

  testWidgets('抽屉底部显示隐私脚注（#2069）', (WidgetTester tester) async {
    await _pump(tester, const <AiSession>[]);
    expect(find.text('方案之间上下文隔离 · 不会互相干扰'), findsOneWidget);
    expect(find.byKey(const Key('ai-session-privacy-footer')), findsOneWidget);
  });
}
