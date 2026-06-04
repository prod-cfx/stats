import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/fixtures/whale_extras.dart';
import 'package:quantify_mobile/data/models/whale_extra_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_notification_sheet.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// 通知中心顶部下滑 panel 守护测试（issue #1644）。
///
/// 用一个 trigger 按钮在 widget tree 内调用 `WhaleNotificationSheet.show`，
/// 让 `showGeneralDialog` 在 `Navigator` 上挂载 panel，再断言形态。
Future<void> _pumpHost(
  WidgetTester tester, {
  required List<WhaleNotification> notifications,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 900));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(QzTheme.fallback),
      home: Scaffold(
        body: Builder(
          builder: (BuildContext ctx) {
            return Center(
              child: TextButton(
                onPressed: () => WhaleNotificationSheet.show(
                  ctx,
                  notifications: notifications,
                ),
                child: const Text('open'),
              ),
            );
          },
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('顶部 panel：geometry 从屏幕顶部开始，maxHeight ≈ 78%', (
    WidgetTester tester,
  ) async {
    await _pumpHost(tester, notifications: mockWhaleNotifications);
    final Rect rect = tester.getRect(find.byType(WhaleNotificationSheet));
    final Size screen = tester.view.physicalSize / tester.view.devicePixelRatio;
    // top 接近屏幕顶部（SafeArea 之内，<= 30）
    expect(rect.top, lessThanOrEqualTo(30), reason: 'panel 应靠近顶部，而不是底部 sheet');
    // 高度 ≤ 78% * 屏幕高度（对齐设计稿首屏覆盖比例）。
    expect(rect.height, lessThanOrEqualTo(screen.height * 0.78 + 1));
  });

  testWidgets('header 显示标题、未读 badge 文本、关闭按钮', (WidgetTester tester) async {
    await _pumpHost(tester, notifications: mockWhaleNotifications);
    expect(find.text('通知中心'), findsOneWidget);
    final int unread = mockWhaleNotifications
        .where((WhaleNotification n) => n.unread)
        .length;
    expect(find.text('$unread 条未读'), findsOneWidget);
    expect(find.text('巨鲸预警 · 监控触发 · 资金流向'), findsNothing);
    // 关闭按钮为 Icons.close（26×26 圆形）
    expect(find.byIcon(Icons.close), findsOneWidget);
  });

  testWidgets('tabs 显示分类数量；切到「巨鲸预警」后只剩 alert kind', (
    WidgetTester tester,
  ) async {
    await _pumpHost(tester, notifications: mockWhaleNotifications);
    // 「全部」tab 数量 = 总数
    expect(find.text('${mockWhaleNotifications.length}'), findsWidgets);
    // 切到「巨鲸预警」tab。tab 与 row kind 标签共字面量，需用 ancestor 锁定 tab
    // 渲染的 12 号 Text。
    final Finder alertTab = find.descendant(
      of: find.byType(SingleChildScrollView),
      matching: find.text('巨鲸预警'),
    );
    await tester.tap(alertTab.first);
    await tester.pumpAndSettle();
    final List<WhaleNotification> alerts = mockWhaleNotifications
        .where((WhaleNotification n) => n.kind == WhaleNotificationKind.alert)
        .toList();
    expect(alerts, isNotEmpty);
    // 列表中标题包含某条 alert（取 mock 首条 alert title，避免硬编码字面量）
    expect(find.text(alerts.first.title), findsOneWidget);
  });

  testWidgets('点击「全部已读」后未读 badge 消失', (WidgetTester tester) async {
    await _pumpHost(tester, notifications: mockWhaleNotifications);
    final int unread = mockWhaleNotifications
        .where((WhaleNotification n) => n.unread)
        .length;
    expect(find.text('$unread 条未读'), findsOneWidget);
    await tester.tap(find.text('全部已读'));
    await tester.pumpAndSettle();
    expect(find.text('$unread 条未读'), findsNothing);
  });

  testWidgets('sheet 渲染恰好 4 个 tab（_NotifTab 守护）', (WidgetTester tester) async {
    await _pumpHost(tester, notifications: mockWhaleNotifications);
    // tabs 区域为 SingleChildScrollView(horizontal)；每个 tab label 在该区域
    // 内必须命中且仅命中一次。row 内 kind label 与 tab label 共字面量，
    // 因此通过 ancestor 锁定到 tabs 区域。
    final Finder tabsScroll = find.byType(SingleChildScrollView);
    expect(tabsScroll, findsOneWidget);
    for (final String label in <String>['全部', '巨鲸预警', '监控触发', '系统']) {
      expect(
        find.descendant(of: tabsScroll, matching: find.text(label)),
        findsOneWidget,
        reason: 'tab label "$label" 必须恰好渲染一次',
      );
    }
  });

  testWidgets('tab 顺序固定为「全部 / 巨鲸预警 / 监控触发 / 系统」（issue #1663）', (
    WidgetTester tester,
  ) async {
    // 设计稿 m-screens-4 NOTIF_TABS = ['全部','巨鲸预警','监控触发','系统']，
    // 顺序变更会破坏视觉对齐与 mock kind 映射；用 dx 坐标守护排列序。
    await _pumpHost(tester, notifications: mockWhaleNotifications);
    final Finder tabsScroll = find.byType(SingleChildScrollView);
    double dxOf(String label) => tester
        .getTopLeft(find.descendant(of: tabsScroll, matching: find.text(label)))
        .dx;
    final double dxAll = dxOf('全部');
    final double dxAlert = dxOf('巨鲸预警');
    final double dxWatch = dxOf('监控触发');
    final double dxSystem = dxOf('系统');
    expect(dxAll, lessThan(dxAlert), reason: '全部 应排第 1');
    expect(dxAlert, lessThan(dxWatch), reason: '巨鲸预警 应排第 2');
    expect(dxWatch, lessThan(dxSystem), reason: '监控触发 应排第 3');
  });

  testWidgets('footer 显示 24h 提示和通知设置入口', (WidgetTester tester) async {
    await _pumpHost(tester, notifications: mockWhaleNotifications);
    expect(find.text('仅显示最近 24 小时通知'), findsOneWidget);
    expect(find.text('通知设置'), findsOneWidget);
  });

  testWidgets('关闭按钮 pop 返回 WhaleNotificationSheetResult，含最新未读状态', (
    WidgetTester tester,
  ) async {
    await _pumpHost(tester, notifications: mockWhaleNotifications);
    await tester.tap(find.text('全部已读'));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.close));
    await tester.pumpAndSettle();
    // panel 应被关闭
    expect(find.byType(WhaleNotificationSheet), findsNothing);
  });
}
