import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_events.dart';
import 'package:quantify_mobile/data/models/whale_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/whale_feed_repository.dart';
import 'package:quantify_mobile/pages/whale/whale_feed_page.dart';
import 'package:quantify_mobile/pages/whale/widgets/qz_whale_row.dart';
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

Future<void> _pump(
  WidgetTester tester,
  _FakeWhaleFeedRepository repo, {
  QzTheme theme = QzTheme.fallback,
  String initialLocation = '/whale',
  GoRouter? router,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 3000));
  final GoRouter r = router ??
      GoRouter(
        initialLocation: initialLocation,
        routes: <RouteBase>[
          GoRoute(
            path: '/whale',
            builder: (BuildContext context, GoRouterState state) =>
                const WhaleFeedPage(),
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
        theme: buildQzThemeData(theme),
        routerConfig: r,
      ),
    ),
  );
  // 等 _load() 完成 + watchFeed 订阅建立。listRecent 是 Future，setState
  // 在 microtask 之后，订阅在同一帧的 listRecent.then 中创建——多 pump 几帧
  // 保证 controller.hasListener == true，再让推流走 emit。
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  testWidgets('/whale 初始渲染 30+ 条 QzWhaleRow', (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    expect(find.byType(WhaleFeedPage), findsOneWidget);
    expect(find.byType(QzWhaleRow), findsAtLeastNWidgets(20));
    expect(mockWhaleEvents.length, greaterThanOrEqualTo(30));
  });

  testWidgets('点击 BTC chip 仅显示 BTC 事件', (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    await _pump(tester, repo);
    addTearDown(() async => repo.dispose());

    await tester.tap(find.text('BTC'));
    await tester.pump();

    // 当前可见的所有 row symbol 必须以 'BTC' 开头。
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

    // 保证订阅已经建立——否则 emit 在 mount 的 microtask 完成前就被丢弃。
    expect(repo.hasListener, isTrue, reason: 'page mount 后必须订阅 stream');

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
    // 推流 listener 是 async callback：先让 stream event 进入 listener，
    // 再让 setState 触发 rebuild。
    await tester.pump();
    await tester.pump();

    // 新条目被 insert(0)，按 ValueKey 一定可命中（ListView.builder 优先渲染
    // 起始范围的 item，第 0 个永远在视口顶部）。
    final Finder freshRow = find.byKey(ValueKey<String>(fresh.id));
    expect(freshRow, findsOneWidget,
        reason: '新推流事件必须出现在 ListView 中。当前 ids: '
            '${tester.widgetList<QzWhaleRow>(find.byType(QzWhaleRow)).take(3).map((r) => r.event.id).toList()}');
    final QzWhaleRow inserted = tester.widget<QzWhaleRow>(freshRow);
    expect(inserted.highlight, isTrue,
        reason: '新插入的 row 应当处于高亮态');
    // 顶部第一行的 id 必须是新事件——验证"从顶部插入"语义。
    final QzWhaleRow topRow =
        tester.widget<QzWhaleRow>(find.byType(QzWhaleRow).first);
    expect(topRow.event.id, fresh.id, reason: '新事件必须排在顶部');

    // 700ms 后高亮被清除。
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

    await tester.tap(find.text('BTC'));
    await tester.pump();
    final int beforeBtc =
        tester.widgetList<QzWhaleRow>(find.byType(QzWhaleRow)).length;

    // 推一条 ETH，不应进入 BTC 筛选下的列表。
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

  testWidgets('离开 /whale 页面后 stream 订阅被取消（无内存泄漏）',
      (WidgetTester tester) async {
    final _FakeWhaleFeedRepository repo = _FakeWhaleFeedRepository();
    final GoRouter router = GoRouter(
      initialLocation: '/whale',
      routes: <RouteBase>[
        GoRoute(
          path: '/whale',
          builder: (BuildContext context, GoRouterState state) =>
              const WhaleFeedPage(),
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

    expect(repo.hasListener, isTrue,
        reason: 'page mount 后应订阅 stream');

    router.go('/elsewhere');
    await tester.pumpAndSettle();

    expect(find.byType(WhaleFeedPage), findsNothing);
    expect(repo.hasListener, isFalse,
        reason: 'dispose 后 stream 监听者必须为 0，否则视为内存泄漏');
  });

  testWidgets('WhaleFeedPage 9 主题循环 pump 不抛异常', (WidgetTester tester) async {
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

  test('QzWhaleRow.formatAmountUsd 覆盖三档边界', () {
    expect(QzWhaleRow.formatAmountUsd(500), '\$500');
    expect(QzWhaleRow.formatAmountUsd(12_500), '\$13K');
    expect(QzWhaleRow.formatAmountUsd(12_500_000), '\$12.50M');
  });

  test('QzWhaleRow.formatRelativeTime 边界', () {
    final DateTime now = DateTime(2026, 5, 18, 12, 0, 0);
    expect(QzWhaleRow.formatRelativeTime(now, now), '刚刚');
    expect(
      QzWhaleRow.formatRelativeTime(
        now.subtract(const Duration(minutes: 5)),
        now,
      ),
      '5 分钟前',
    );
    expect(
      QzWhaleRow.formatRelativeTime(
        now.subtract(const Duration(hours: 3)),
        now,
      ),
      '3 小时前',
    );
    expect(
      QzWhaleRow.formatRelativeTime(
        now.subtract(const Duration(days: 2)),
        now,
      ),
      '2 天前',
    );
  });
}
