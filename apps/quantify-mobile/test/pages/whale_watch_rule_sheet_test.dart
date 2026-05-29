import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/whale_watch_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_watch_rule_sheet.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

WatchRule? _result;
bool _returned = false;

Future<void> _pump(WidgetTester tester, {WatchRule? initial}) async {
  _result = null;
  _returned = false;
  await tester.binding.setSurfaceSize(const Size(420, 1100));
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(
          const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
        ),
        home: Scaffold(
          body: Center(
            child: Builder(
              builder: (BuildContext ctx) => ElevatedButton(
                onPressed: () async {
                  _result =
                      await WhaleWatchRuleSheet.show(ctx, initial: initial);
                  _returned = true;
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('新增态：标题与创建按钮，地址可编辑', (WidgetTester tester) async {
    await _pump(tester);
    expect(find.text('添加地址监控'), findsOneWidget);
    expect(find.text('创建监控'), findsOneWidget);
  });

  testWidgets('校验失败：空地址/空阈值阻止提交，行内错误提示',
      (WidgetTester tester) async {
    await _pump(tester);
    await tester.tap(find.text('创建监控'));
    await tester.pumpAndSettle();
    expect(find.text('请输入监控地址'), findsOneWidget);
    expect(find.text('请输入触发阈值'), findsOneWidget);
    expect(_returned, isFalse, reason: '校验未过不应返回');
  });

  testWidgets('阈值非正数：报错', (WidgetTester tester) async {
    await _pump(tester);
    final List<TextFormField> fields =
        tester.widgetList<TextFormField>(find.byType(TextFormField)).toList();
    expect(fields.length, 2);
    await tester.enterText(find.byType(TextFormField).at(0), '0xabc…1234');
    await tester.enterText(find.byType(TextFormField).at(1), '-5');
    await tester.tap(find.text('创建监控'));
    await tester.pumpAndSettle();
    expect(find.text('阈值需为大于 0 的数字'), findsOneWidget);
    expect(_returned, isFalse);
  });

  testWidgets('合法提交：返回新建 WatchRule', (WidgetTester tester) async {
    await _pump(tester);
    await tester.enterText(find.byType(TextFormField).at(0), '0xabc…1234');
    await tester.enterText(find.byType(TextFormField).at(1), '2000000');
    await tester.tap(find.text('创建监控'));
    await tester.pumpAndSettle();
    expect(_returned, isTrue);
    expect(_result, isNotNull);
    expect(_result!.address, '0xabc…1234');
    expect(_result!.thresholdUsd, 2000000);
    expect(_result!.channels, isNotEmpty);
  });

  testWidgets('编辑态：预填字段、标题为编辑、保存返回更新规则',
      (WidgetTester tester) async {
    const WatchRule initial = WatchRule(
      id: 'w1',
      name: 'Cumberland',
      address: '0x4f9…0e1c',
      lastEventDisplay: 'e',
      tone: 'dn',
      pnlDisplay: '-3.2%',
      live: false,
      thresholdUsd: 5000000,
      direction: WatchRuleDirection.outflow,
      channels: <WatchRuleChannel>{WatchRuleChannel.push},
      muted: false,
    );
    await _pump(tester, initial: initial);
    expect(find.text('编辑监控规则'), findsOneWidget);
    expect(find.text('保存'), findsOneWidget);
    // 阈值预填
    expect(find.text('5000000'), findsOneWidget);
    // 改阈值并保存
    await tester.enterText(find.byType(TextFormField).at(1), '8000000');
    await tester.tap(find.text('保存'));
    await tester.pumpAndSettle();
    expect(_returned, isTrue);
    expect(_result!.id, 'w1');
    expect(_result!.thresholdUsd, 8000000);
    expect(_result!.address, '0x4f9…0e1c');
  });
}
