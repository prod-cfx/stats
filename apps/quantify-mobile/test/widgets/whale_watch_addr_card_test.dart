import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/whale_watch_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_watch_addr_card.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

const WatchRule _filled = WatchRule(
  id: 'w1',
  name: '我的关注',
  address: '0xa83…b8f2',
  lastEventDisplay: 'e',
  tone: 'up',
  pnlDisplay: '+12.8%',
  live: true,
  thresholdUsd: 1000000,
  channels: <WatchRuleChannel>{WatchRuleChannel.push},
  muted: false,
  alias: 'Galaxy 主仓',
  perpValueUsd: 12480000,
  unrealizedPnlUsd: 842000,
  availMarginUsd: 3260000,
  marginUsagePct: 42,
  positions: 6,
);

const WatchRule _empty = WatchRule(
  id: 'w3',
  name: '冷钱包',
  address: '0xb2e…91d7',
  lastEventDisplay: 'e',
  tone: 'up',
  pnlDisplay: '—',
  live: false,
  thresholdUsd: 1000000,
  channels: <WatchRuleChannel>{WatchRuleChannel.email},
  muted: true,
);

Future<void> _pump(WidgetTester tester, WatchRule rule) async {
  await tester.binding.setSurfaceSize(const Size(420, 800));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(
        const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
      ),
      home: Scaffold(
        body: WhaleWatchAddrCard(
          rule: rule,
          onOpen: () {},
          onToggleMute: () {},
          onEdit: () {},
          onDelete: () {},
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('渲染 5 个永续字段标签（永续总价值/未实现盈亏/可用保证金/保证金率/持仓）', (
    WidgetTester tester,
  ) async {
    await _pump(tester, _filled);
    expect(find.text('永续合约总价值'), findsOneWidget);
    expect(find.text('未实现盈亏'), findsOneWidget);
    expect(find.text('可用保证金'), findsOneWidget);
    expect(find.text('保证金使用率'), findsOneWidget);
    expect(find.text('持仓'), findsOneWidget);
  });

  testWidgets('有仓地址：渲染格式化金额 + 正向盈亏 + 保证金率', (WidgetTester tester) async {
    await _pump(tester, _filled);
    expect(find.text('\$12.5M'), findsOneWidget); // perp value
    expect(find.text('+\$842.0K'), findsOneWidget); // unrealized pnl
    expect(find.text('42%'), findsOneWidget);
    expect(find.text('6'), findsOneWidget);
    expect(find.text('Galaxy 主仓'), findsOneWidget); // alias
  });

  testWidgets('空仓地址：永续字段全部以 `-` 占位', (WidgetTester tester) async {
    await _pump(tester, _empty);
    // perp/avail/pnl → '-'；usage/positions → '-'
    expect(find.text('-'), findsWidgets);
    expect(find.text('\$12.5M'), findsNothing);
  });

  testWidgets('趋势/静音/编辑/删除操作按钮存在', (WidgetTester tester) async {
    await _pump(tester, _filled);
    expect(find.byIcon(Icons.trending_up), findsOneWidget);
    expect(find.byIcon(Icons.delete_outline), findsOneWidget);
    expect(find.byIcon(Icons.edit_outlined), findsOneWidget);
    // 未静音 → 显示 notifications_outlined（点击静音）
    expect(find.byIcon(Icons.notifications_outlined), findsOneWidget);
  });
}
