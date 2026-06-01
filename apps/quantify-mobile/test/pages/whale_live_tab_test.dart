import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_events.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/data/models/whale_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/whale_feed_repository.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_live_tab.dart';
import 'package:quantify_mobile/pages/whale/widgets/qz_whale_row.dart';
import 'package:quantify_mobile/widgets/qz_chip.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

class _FakeWhaleFeedRepository implements WhaleFeedRepository {
  _FakeWhaleFeedRepository({List<WhaleEvent>? history})
      : _history = history ?? mockWhaleEvents.reversed.toList();

  final List<WhaleEvent> _history;
  final StreamController<WhaleEvent> _controller =
      StreamController<WhaleEvent>.broadcast();

  bool get hasListener => _controller.hasListener;

  void emit(WhaleEvent event) => _controller.add(event);

  Future<void> dispose() async {
    await _controller.close();
  }

  @override
  Future<List<WhaleEvent>> listRecent({required int limit}) async {
    final int take = limit > _history.length ? _history.length : limit;
    return _history.sublist(0, take);
  }

  @override
  Stream<WhaleEvent> watchFeed() => _controller.stream;
}

/// Live tab 在原型中作为 page body，本测试把它装到一个最小 Scaffold 内
/// 模拟实际宿主（WhaleHomePage 也是同样模式）。
Future<void> _pump(
  WidgetTester tester,
  _FakeWhaleFeedRepository repo, {
  QzTheme theme = QzTheme.fallback,
  String initialLocation = '/live',
  GoRouter? router,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 3000));
  final GoRouter r = router ??
      GoRouter(
        initialLocation: initialLocation,
        routes: <RouteBase>[
          GoRoute(
            path: '/live',
            builder: (BuildContext context, GoRouterState state) =>
                const Scaffold(body: WhaleLiveTab()),
          ),
          GoRoute(
            path: '/elsewhere',
            builder: (BuildContext context, GoRouterState state) =>
                const Scaffold(body: Text('elsewhere')),
          ),
        ],
      );
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        whaleFeedRepositoryProvider.overrideWithValue(repo),
      ],
      child: MaterialApp.router(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(theme),
        routerConfig: r,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  testWidgets('Live tab 初始渲染 ≥1 条 QzWhaleRow (默认 BTC + ≥\$5M, issue #1604)',
      (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    expect(find.byType(WhaleLiveTab), findsOneWidget);
    // 默认 BTC + ≥$5M 过滤后行数会显著减少，但 mock 数据集足够保证 ≥1 条。
    expect(find.byType(QzWhaleRow), findsAtLeastNWidgets(1));
    expect(mockWhaleEvents.length, greaterThanOrEqualTo(30));
  });

  testWidgets('默认顶部交互区对齐设计稿：BTC chip 选中 + 阈值输入框默认 500000 + 创建监控 + 倒计时 + LIVE (issue #1986)',
      (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    final QzChip btcChip =
        tester.widget<QzChip>(find.widgetWithText(QzChip, 'BTC'));
    expect(btcChip.tone, QzChipTone.accent, reason: '默认必须选中 BTC');

    // 阈值改为自由文本输入框，默认 500000（验收标准 [1]）。
    final Finder thresholdField = find.byType(TextField);
    expect(thresholdField, findsOneWidget, reason: '阈值应为自由文本输入框');
    final TextField field = tester.widget<TextField>(thresholdField);
    expect(field.controller?.text, '500000', reason: '默认阈值 500000');
    expect(find.text('≥ \$'), findsOneWidget, reason: '输入框前缀 ≥ \$');

    // 旧预设档位 pill 不应再存在。
    expect(find.widgetWithText(QzChip, '≥ \$5M'), findsNothing);

    // 「创建监控」按钮替换「关注币种推送」（验收标准 [2]）。
    expect(find.text('创建监控'), findsOneWidget);
    expect(find.text('关注币种推送'), findsNothing);

    // 「{n} 秒后更新」倒计时（验收标准 [3]）。
    expect(find.textContaining('秒后更新'), findsOneWidget);

    expect(find.text('LIVE'), findsOneWidget);
  });

  testWidgets('阈值输入框改值后过滤生效：输入 9000000 过滤掉低于该值的事件 (issue #1986)',
      (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    final int before =
        tester.widgetList<QzWhaleRow>(find.byType(QzWhaleRow)).length;
    await tester.enterText(find.byType(TextField), '9000000');
    await tester.pump();
    final int after =
        tester.widgetList<QzWhaleRow>(find.byType(QzWhaleRow)).length;
    expect(after, lessThanOrEqualTo(before),
        reason: '提高阈值后可见行数不应增加');
    for (final QzWhaleRow row
        in tester.widgetList<QzWhaleRow>(find.byType(QzWhaleRow))) {
      expect(row.event.amountUsd, greaterThanOrEqualTo(9000000));
    }
  });

  testWidgets('feed 空态展示「无匹配推送」(issue #1986)',
      (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    // 设极高阈值清空 feed。
    await tester.enterText(find.byType(TextField), '999999999999');
    await tester.pump();
    expect(find.byType(QzWhaleRow), findsNothing);
    expect(find.text('无匹配推送'), findsOneWidget);
  });

  testWidgets('点击「创建监控」打开监控规则弹窗并 prefill 阈值 (issue #1986)',
      (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    await tester.enterText(find.byType(TextField), '750000');
    await tester.pump();
    await tester.tap(find.text('创建监控'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // 弹窗标题（新增态）可见，且阈值字段被 prefill 为输入值。
    final Iterable<TextField> fields =
        tester.widgetList<TextField>(find.byType(TextField));
    final bool hasPrefilled =
        fields.any((TextField f) => f.controller?.text == '750000');
    expect(hasPrefilled, isTrue, reason: '监控弹窗应 prefill 阈值 750000');
  });

  testWidgets('默认 BTC chip 下所有 row 都是 BTC', (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    final Iterable<QzWhaleRow> rows =
        tester.widgetList<QzWhaleRow>(find.byType(QzWhaleRow));
    expect(rows.isNotEmpty, isTrue);
    for (final QzWhaleRow row in rows) {
      expect(row.event.symbol.startsWith('BTC'), isTrue,
          reason: 'leaked non-BTC: ${row.event.symbol}');
    }
  });

  testWidgets('推流 emit 新 BTC 事件 → 顶部插入 + AnimatedContainer 高亮态',
      (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    expect(repo.hasListener, isTrue, reason: 'tab mount 后必须订阅 stream');

    final WhaleEvent fresh = WhaleEvent(
      id: 'w-fresh-001',
      symbol: 'BTCUSDT',
      amountUsd: 9_999_999,
      direction: 'in',
      fromLabel: 'Fresh',
      toLabel: 'Top',
      winRate: 80,
      timestamp: DateTime.now(),
    );
    repo.emit(fresh);
    await tester.pump();
    await tester.pump();

    final Finder freshRow = find.byKey(ValueKey<String>(fresh.id));
    expect(freshRow, findsOneWidget,
        reason: '新推流事件必须出现在 ListView 中');
    final QzWhaleRow inserted = tester.widget<QzWhaleRow>(freshRow);
    expect(inserted.highlight, isTrue, reason: '新插入的 row 应当处于高亮态');
    final QzWhaleRow topRow =
        tester.widget<QzWhaleRow>(find.byType(QzWhaleRow).first);
    expect(topRow.event.id, fresh.id, reason: '新事件必须排在顶部');

    await tester.pump(const Duration(milliseconds: 750));
    final QzWhaleRow firstAfterDelay =
        tester.widget<QzWhaleRow>(find.byType(QzWhaleRow).first);
    expect(firstAfterDelay.highlight, isFalse,
        reason: '700ms 后高亮应被清除');
  });

  testWidgets('过滤不匹配的推流事件不会进入列表', (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    // 默认 BTC + ≥$5M。直接复用默认状态测试 ETH 事件不会被插入。
    final int beforeBtc =
        tester.widgetList<QzWhaleRow>(find.byType(QzWhaleRow)).length;

    repo.emit(WhaleEvent(
      id: 'w-eth-emit',
      symbol: 'ETHUSDT',
      amountUsd: 6_000_000,
      direction: 'in',
      fromLabel: 'X',
      toLabel: 'Y',
      winRate: 80,
      timestamp: DateTime.now(),
    ));
    await tester.pump();
    final int afterEth =
        tester.widgetList<QzWhaleRow>(find.byType(QzWhaleRow)).length;
    expect(afterEth, beforeBtc, reason: 'ETH 不应在 BTC chip 下被插入');
  });

  testWidgets('离开 /live 页面后 stream 订阅被取消（无内存泄漏）',
      (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    final GoRouter router = GoRouter(
      initialLocation: '/live',
      routes: <RouteBase>[
        GoRoute(
          path: '/live',
          builder: (BuildContext context, GoRouterState state) =>
              const Scaffold(body: WhaleLiveTab()),
        ),
        GoRoute(
          path: '/elsewhere',
          builder: (BuildContext context, GoRouterState state) =>
              const Scaffold(body: Text('elsewhere')),
        ),
      ],
    );
    await _pump(tester, repo, router: router);
    addTearDown(() async => repo.dispose());

    expect(repo.hasListener, isTrue, reason: 'tab mount 后应订阅 stream');

    router.go('/elsewhere');
    // 倒计时 Timer.periodic 使 pumpAndSettle 无法收敛，改用有界 pump 循环推进
    // 路由转场直至旧页卸载（issue #1986）。
    await tester.pump();
    for (int i = 0; i < 20 && find.byType(WhaleLiveTab).evaluate().isNotEmpty; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(find.byType(WhaleLiveTab), findsNothing);
    expect(repo.hasListener, isFalse,
        reason: 'dispose 后 stream 监听者必须为 0，否则视为内存泄漏');
  });

  testWidgets('WhaleLiveTab 9 主题循环 pump 不抛异常',
      (WidgetTester tester) async {
    for (final QzBg bg in QzBg.values) {
      for (final QzAccent accent in QzAccent.values) {
        final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
        await _pump(tester, repo, theme: QzTheme(bg: bg, accent: accent));
        // issue #1604：默认 BTC + ≥$5M 过滤后行数减少；保留 ≥1 条作为渲染存活信号。
        expect(find.byType(QzWhaleRow), findsAtLeastNWidgets(1));
        expect(
          tester.takeException(),
          isNull,
          reason: 'theme bg=$bg accent=$accent',
        );
        await repo.dispose();
      }
    }
  });

  testWidgets('mock fixture 场景行内不出现 731 天前 / 天前 时间穿帮 (issue #1602)',
      (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    // 任何 row 都不应显示「天前」级别的相对时间
    expect(find.textContaining('天前'), findsNothing,
        reason: 'mock fixture timestamp 2024-05 不应直接作为相对时间基准');
    // 至少有一条行显示「刚刚」或「分钟前」/「小时前」
    final bool hasNearLabel = find.textContaining('刚刚').evaluate().isNotEmpty ||
        find.textContaining('分钟前').evaluate().isNotEmpty ||
        find.textContaining('小时前').evaluate().isNotEmpty;
    expect(hasNearLabel, isTrue,
        reason: '应当看到近期相对时间标签（刚刚 / 分钟前 / 小时前）');
  });

  testWidgets('推流相同 id 不会触发 Duplicate Key / ListView child order 异常 (issue #1603)',
      (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    final WhaleEvent first = WhaleEvent(
      id: 'w-dup-001',
      symbol: 'BTCUSDT',
      amountUsd: 7_500_000,
      direction: 'in',
      fromLabel: 'A',
      toLabel: 'B',
      winRate: 80,
      timestamp: DateTime.now(),
    );
    repo.emit(first);
    await tester.pump();
    await tester.pump();

    // 重发相同 id（可能来自后端重试 / 重连）
    final WhaleEvent dup = WhaleEvent(
      id: 'w-dup-001',
      symbol: 'BTCUSDT',
      amountUsd: 8_000_000,
      direction: 'in',
      fromLabel: 'A2',
      toLabel: 'B2',
      winRate: 80,
      timestamp: DateTime.now(),
    );
    repo.emit(dup);
    await tester.pump();
    await tester.pump();

    // 同 id 应只出现一次
    expect(find.byKey(const ValueKey<String>('w-dup-001')), findsOneWidget);
    // 不应抛任何异常
    expect(tester.takeException(), isNull);

    // 等待 700ms 高亮回调过期
    await tester.pump(const Duration(milliseconds: 750));
    expect(tester.takeException(), isNull);
  });

  testWidgets('历史接口返回重复 id 时 ListView 也只渲染一次 (issue #1603)',
      (WidgetTester tester) async {
    final WhaleEvent base = mockWhaleEvents.first;
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository(
      history: <WhaleEvent>[base, base, ...mockWhaleEvents.skip(1)],
    );
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    expect(find.byKey(ValueKey<String>(base.id)), findsOneWidget,
        reason: '历史中重复 id 必须去重后只渲染一次');
    expect(tester.takeException(), isNull);
  });

  test('QzWhaleRow.formatAmountUsd 覆盖三档边界', () {
    expect(QzWhaleRow.formatAmountUsd(500), '\$500');
    expect(QzWhaleRow.formatAmountUsd(12_500), '\$13K');
    expect(QzWhaleRow.formatAmountUsd(12_500_000), '\$12.50M');
  });

  test('QzWhaleRow.formatRelativeTime 边界', () {
    final DateTime now = DateTime(2026, 5, 18, 12, 0, 0);
    expect(QzWhaleRow.formatRelativeTime(now, now), 'just now');
    expect(
      QzWhaleRow.formatRelativeTime(
        now.subtract(const Duration(minutes: 5)),
        now,
      ),
      '5m ago',
    );
    expect(
      QzWhaleRow.formatRelativeTime(
        now.subtract(const Duration(hours: 3)),
        now,
      ),
      '3h ago',
    );
    expect(
      QzWhaleRow.formatRelativeTime(
        now.subtract(const Duration(days: 2)),
        now,
      ),
      '2d ago',
    );
  });

  // ---- issue #1983: 胜率排序 ----

  // 默认 BTC + ≥$5M 下保留 ≥3 条、winRate 互异的 BTC 历史，便于断言排序顺序。
  List<WhaleEvent> winSortHistory() {
    DateTime ts(int i) => DateTime.now().subtract(Duration(minutes: i));
    return <WhaleEvent>[
      WhaleEvent(
        id: 's-low',
        symbol: 'BTCUSDT',
        amountUsd: 6_000_000,
        direction: 'in',
        fromLabel: 'A',
        toLabel: 'B',
        winRate: 40,
        timestamp: ts(1),
      ),
      WhaleEvent(
        id: 's-high',
        symbol: 'BTCUSDT',
        amountUsd: 7_000_000,
        direction: 'in',
        fromLabel: 'A',
        toLabel: 'B',
        winRate: 90,
        timestamp: ts(2),
      ),
      WhaleEvent(
        id: 's-mid',
        symbol: 'BTCUSDT',
        amountUsd: 8_000_000,
        direction: 'out',
        fromLabel: 'A',
        toLabel: 'B',
        winRate: 65,
        timestamp: ts(3),
      ),
    ];
  }

  testWidgets('胜率排序按钮可点击，不再弹禁用提示 (issue #1983)',
      (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo =
        _FakeWhaleFeedRepository(history: winSortHistory());
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    // 旧禁用文案不应再出现
    expect(find.text('胜率排序需交易级数据，接入后启用'), findsNothing);

    final Finder sortBtn = find.widgetWithText(OutlinedButton, '胜率');
    expect(sortBtn, findsOneWidget);
    final OutlinedButton btn = tester.widget<OutlinedButton>(sortBtn);
    expect(btn.onPressed, isNotNull, reason: '胜率排序按钮必须可点击');
  });

  testWidgets('胜率排序循环 none→desc→asc→none 改变行顺序 (issue #1983)',
      (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo =
        _FakeWhaleFeedRepository(history: winSortHistory());
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    List<String> rowIds() => tester
        .widgetList<QzWhaleRow>(find.byType(QzWhaleRow))
        .map((QzWhaleRow r) => r.event.id)
        .toList();

    final Finder sortBtn = find.widgetWithText(OutlinedButton, '胜率');

    // 第一次点击 → 降序：90, 65, 40
    await tester.tap(sortBtn);
    await tester.pump();
    expect(rowIds(), <String>['s-high', 's-mid', 's-low'],
        reason: '降序应按 winRate 从高到低');

    // 第二次点击 → 升序：40, 65, 90
    await tester.tap(sortBtn);
    await tester.pump();
    expect(rowIds(), <String>['s-low', 's-mid', 's-high'],
        reason: '升序应按 winRate 从低到高');

    // 第三次点击 → 取消排序（回到时间分组）：不抛异常且三条仍在
    await tester.tap(sortBtn);
    await tester.pump();
    expect(find.byType(QzWhaleRow), findsNWidgets(3));
    expect(tester.takeException(), isNull);
  });
}
