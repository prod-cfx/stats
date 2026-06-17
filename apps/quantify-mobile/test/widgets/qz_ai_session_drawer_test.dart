import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/ai_chat_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/pages/ai/widgets/qz_ai_session_drawer.dart';

Future<void> _pump(
  WidgetTester tester,
  List<AiSession> sessions, {
  String? currentId,
  ValueChanged<String>? onDelete,
  AiSessionRenameCallback? onRename,
  Future<void> Function()? onRefresh,
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
          onDelete: onDelete ?? (_) {},
          onRename: onRename ?? (_, _) {},
          onRefresh: onRefresh ?? () async {},
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('会话项显示状态徽标、更新时间和常驻删除按钮（#2069）', (WidgetTester tester) async {
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
    expect(find.text('趋势跟踪'), findsNothing);
    expect(find.text('网格'), findsNothing);
    expect(find.text('✓ 已部署 · 实盘运行中'), findsNothing);
    expect(find.text('已生成策略参数'), findsNothing);
    expect(find.text('+31.6%'), findsNothing);
    expect(find.text('5 分钟前'), findsOneWidget);
    expect(find.text('刚刚'), findsOneWidget);
    expect(find.byKey(const Key('ai-session-rename-s-live')), findsOneWidget);
    expect(find.byKey(const Key('ai-session-rename-s-wip')), findsOneWidget);
    expect(find.byKey(const Key('ai-session-delete-s-live')), findsOneWidget);
    expect(find.byKey(const Key('ai-session-delete-s-wip')), findsOneWidget);
  });

  testWidgets('抽屉底部显示隐私脚注（#2069）', (WidgetTester tester) async {
    await _pump(tester, const <AiSession>[]);
    expect(find.text('方案之间上下文隔离 · 不会互相干扰'), findsOneWidget);
    expect(find.byKey(const Key('ai-session-privacy-footer')), findsOneWidget);
  });

  testWidgets('非空会话列表支持下拉刷新', (WidgetTester tester) async {
    final DateTime now = DateTime.now();
    int refreshes = 0;
    await _pump(
      tester,
      <AiSession>[
        AiSession(
          id: 's-wip',
          title: 'ETH 4H 均值回归',
          category: '均值回归',
          updatedAt: now,
          messages: const <ChatTurn>[],
        ),
      ],
      currentId: 's-wip',
      onRefresh: () async => refreshes++,
    );

    expect(find.byType(RefreshIndicator), findsOneWidget);

    await tester.fling(find.byType(ListView), const Offset(0, 360), 1000);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(refreshes, 1);
  });

  testWidgets('空会话列表也支持下拉刷新', (WidgetTester tester) async {
    int refreshes = 0;
    await _pump(
      tester,
      const <AiSession>[],
      onRefresh: () async => refreshes++,
    );

    expect(find.byType(RefreshIndicator), findsOneWidget);

    await tester.fling(find.byType(ListView), const Offset(0, 360), 1000);
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(refreshes, 1);
  });

  testWidgets('点击删除按钮把会话 id 交给页面流程处理', (WidgetTester tester) async {
    final DateTime now = DateTime.now();
    final List<String> deletedIds = <String>[];
    await _pump(
      tester,
      <AiSession>[
        AiSession(
          id: 's-wip',
          title: 'ETH 4H 均值回归',
          category: '均值回归',
          updatedAt: now,
          messages: const <ChatTurn>[],
        ),
      ],
      currentId: 's-wip',
      onDelete: deletedIds.add,
    );

    await tester.tap(find.byKey(const Key('ai-session-delete-s-wip')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('ai-session-delete-dialog')), findsNothing);
    expect(deletedIds, <String>['s-wip']);
  });

  testWidgets('点击编辑按钮后可保存会话名称', (WidgetTester tester) async {
    final DateTime now = DateTime.now();
    final List<String> renamed = <String>[];
    await _pump(
      tester,
      <AiSession>[
        AiSession(
          id: 's-wip',
          title: 'ETH 4H 均值回归',
          category: '均值回归',
          updatedAt: now,
          messages: const <ChatTurn>[],
        ),
      ],
      currentId: 's-wip',
      onRename: (String id, String title) => renamed.add('$id:$title'),
    );

    await tester.tap(find.byKey(const Key('ai-session-rename-s-wip')));
    await tester.pumpAndSettle();

    final Finder input = find.byKey(const Key('ai-session-title-input-s-wip'));
    expect(input, findsOneWidget);

    await tester.enterText(input, 'ETH 改名会话');
    await tester.tap(find.byKey(const Key('ai-session-rename-save-s-wip')));
    await tester.pumpAndSettle();

    expect(renamed, <String>['s-wip:ETH 改名会话']);
    expect(input, findsNothing);
  });

  testWidgets('删除确认使用底部抽屉并返回确认结果', (WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(420, 900));
    final DateTime now = DateTime.now();
    final AiSession session = AiSession(
      id: 's-wip',
      title: 'ETH 4H 均值回归',
      category: '均值回归',
      updatedAt: now,
      messages: const <ChatTurn>[],
    );
    bool? confirmed;

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(
          const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
        ),
        home: Scaffold(
          body: Builder(
            builder: (BuildContext context) => TextButton(
              onPressed: () async {
                confirmed = await showQzAiSessionDeleteDialog(
                  context,
                  session: session,
                );
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('ai-session-delete-dialog')), findsOneWidget);
    expect(find.byType(Dialog), findsNothing);
    expect(find.text('删除该会话？'), findsOneWidget);
    expect(find.text('ETH 4H 均值回归'), findsOneWidget);

    await tester.tap(find.text('删除'));
    await tester.pumpAndSettle();

    expect(confirmed, isTrue);
  });
}
