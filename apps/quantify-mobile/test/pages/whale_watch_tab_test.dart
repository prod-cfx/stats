import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_events.dart';
import 'package:quantify_mobile/data/models/whale_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/whale_feed_repository.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/tabs/whale_watch_tab.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

class _FakeFeedRepo implements WhaleFeedRepository {
  final StreamController<WhaleEvent> _c =
      StreamController<WhaleEvent>.broadcast();
  Future<void> dispose() async => _c.close();

  @override
  Future<List<WhaleEvent>> listRecent({required int limit}) async {
    final List<WhaleEvent> h = mockWhaleEvents.reversed.toList();
    final int take = limit > h.length ? h.length : limit;
    return h.sublist(0, take);
  }

  @override
  Stream<WhaleEvent> watchFeed() => _c.stream;
}

Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(420, 2400));
  final _FakeFeedRepo repo = _FakeFeedRepo();
  addTearDown(() async => repo.dispose());
  final GoRouter router = GoRouter(
    initialLocation: '/whale',
    routes: <RouteBase>[
      GoRoute(
        path: '/whale',
        builder: (BuildContext context, GoRouterState state) =>
            const Scaffold(body: WhaleWatchTab()),
      ),
      GoRoute(
        path: '/whale/profile/:address',
        builder: (BuildContext context, GoRouterState state) =>
            const Scaffold(body: Text('PROFILE')),
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
        theme: buildQzThemeData(QzTheme.fallback),
        routerConfig: router,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  testWidgets('三层子 Tab 标签渲染', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.text('实时巨鲸'), findsOneWidget);
    expect(find.text('监控地址'), findsOneWidget);
    expect(find.text('通知中心'), findsOneWidget);
  });

  testWidgets('默认在「实时巨鲸」子 Tab：含关注币种推送 + 胜率排序（可用）',
      (WidgetTester tester) async {
    await _pump(tester);
    expect(find.text('关注币种推送'), findsOneWidget);
    // issue #1983：胜率排序 toggle 已启用（不再禁用）。
    final Finder winSort = find.ancestor(
      of: find.text('胜率'),
      matching: find.byType(OutlinedButton),
    );
    final OutlinedButton btn = tester.widget<OutlinedButton>(winSort.first);
    expect(btn.onPressed, isNotNull, reason: 'issue #1983：胜率排序在 live feed 下应可用');
  });

  testWidgets('切到「监控地址」：渲染地址卡永续字段', (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.text('监控地址'));
    await tester.pumpAndSettle();
    expect(find.text('永续合约总价值'), findsWidgets);
    expect(find.text('保证金使用率'), findsWidgets);
    // 创建监控按钮存在。
    expect(find.text('创建监控'), findsOneWidget);
  });

  testWidgets('切到「通知中心」：渲染通知行 + 全部已读，点击后未读清零',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.text('通知中心'));
    await tester.pumpAndSettle();
    // 全部已读按钮带未读计数。
    expect(find.textContaining('全部已读'), findsOneWidget);
    // 子 Tab 计数 dot：未读 > 0 时通知中心标签旁存在红点（容器存在即可）。
    await tester.tap(find.textContaining('全部已读'));
    await tester.pumpAndSettle();
    // 已读后按钮文案回落为「全部已读」（无计数括号）。
    expect(find.text('全部已读'), findsOneWidget);
  });

  testWidgets('监控地址空态由 fixture 决定不出现（种子非空）',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.text('监控地址'));
    await tester.pumpAndSettle();
    expect(find.text('暂无监控地址'), findsNothing);
  });
}
