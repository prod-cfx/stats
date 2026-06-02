import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/ai/ai_script_page.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// #1892 验收：「策略脚本」独立步骤屏，覆盖 生成中 → 就绪 两态。
Future<void> _pump(WidgetTester tester, {Map<String, String>? params}) async {
  await tester.binding.setSurfaceSize(const Size(420, 2400));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(
        const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
      ),
      home: AiScriptPage(params: params),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('生成中态：显示 spinner + 文案，CTA 禁用（验收 2、5）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    expect(find.byKey(const Key('ai-script-generating')), findsOneWidget);
    expect(find.text('正在生成策略脚本'), findsOneWidget);
    expect(find.text('编译参数 · 校验语法 · 注入风控'), findsOneWidget);

    final FilledButton next = tester.widget<FilledButton>(
      find.byKey(const Key('ai-script-next-cta')),
    );
    expect(next.onPressed, isNull, reason: '生成中态「下一步」不可点');

    // 收尾 timer，避免 pending timer 报错。
    await tester.pump(const Duration(milliseconds: 1600));
  });

  testWidgets('就绪态：READY badge + 行号 + 成功提示，CTA 可点（验收 3、5）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    await tester.pump(const Duration(milliseconds: 1600));

    expect(find.byKey(const Key('ai-script-ready-badge')), findsOneWidget);
    expect(find.byKey(const Key('ai-script-success-hint')), findsOneWidget);
    // 行号：第 1 行存在。
    expect(find.text('1'), findsWidgets);

    final FilledButton next = tester.widget<FilledButton>(
      find.byKey(const Key('ai-script-next-cta')),
    );
    expect(next.onPressed, isNotNull, reason: '就绪态「下一步」可点');
  });

  testWidgets('长脚本：展开折叠切换文案「查看全部 N 行 / 收起」（验收 4）', (WidgetTester tester) async {
    await _pump(tester);
    await tester.pump(const Duration(milliseconds: 1600));

    final Finder toggle = find.byKey(const Key('ai-script-expand-toggle'));
    expect(toggle, findsOneWidget);
    expect(find.textContaining('查看全部'), findsOneWidget);

    await tester.tap(toggle);
    await tester.pump();
    expect(find.text('收起'), findsOneWidget);
  });

  testWidgets('文件名取自 strat.file，不写死 strategy.js（验收 6）', (
    WidgetTester tester,
  ) async {
    await _pump(
      tester,
      params: <String, String>{
        'symbol': 'ETH/USDT',
        'file': 'eth_range_grid.js',
      },
    );
    await tester.pump(const Duration(milliseconds: 1600));

    // recap badge + 终端头部均显示真实文件名。
    expect(find.text('eth_range_grid.js'), findsWidgets);
    expect(find.text('strategy.js'), findsNothing);
  });

  testWidgets('无 file 字段时由 symbol 派生文件名（验收 6）', (WidgetTester tester) async {
    await _pump(tester, params: <String, String>{'symbol': 'BTC/USDT'});
    await tester.pump(const Duration(milliseconds: 1600));
    expect(find.text('btc_trend_ma.js'), findsWidgets);
  });

  test('脚本页 fallback 杠杆默认 5x（#2066）', () {
    expect(kStratFallbackParams['leverage'], '5x');
  });
}
