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
  testWidgets('Live tab 初始渲染 ≥10 条 QzWhaleRow', (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    expect(find.byType(WhaleLiveTab), findsOneWidget);
    expect(find.byType(QzWhaleRow), findsAtLeastNWidgets(10));
    expect(mockWhaleEvents.length, greaterThanOrEqualTo(30));
  });

  testWidgets('点击 BTC chip 仅显示 BTC 事件', (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    await tester.tap(find.widgetWithText(QzChip, 'BTC'));
    await tester.pump();

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

    await tester.tap(find.widgetWithText(QzChip, 'BTC'));
    await tester.pump();
    final int beforeBtc =
        tester.widgetList<QzWhaleRow>(find.byType(QzWhaleRow)).length;

    repo.emit(WhaleEvent(
      id: 'w-eth-emit',
      symbol: 'ETHUSDT',
      amountUsd: 4_000_000,
      direction: 'in',
      fromLabel: 'X',
      toLabel: 'Y',
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
    await tester.pumpAndSettle();

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
        expect(find.byType(QzWhaleRow), findsAtLeastNWidgets(10));
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
}
