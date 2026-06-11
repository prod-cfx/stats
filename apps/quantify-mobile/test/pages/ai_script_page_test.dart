import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/ai_strategy_context.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/ai/ai_script_page.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// #1892 验收：「策略脚本」独立步骤屏，覆盖 生成中 → 就绪 两态。
Future<void> _pump(
  WidgetTester tester, {
  Map<String, String>? params,
  AiPublishedStrategyContext? strategyContext,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 2400));
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(
          const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
        ),
        home: AiScriptPage(params: params, strategyContext: strategyContext),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  const AiPublishedStrategyContext publishedContext =
      AiPublishedStrategyContext(
        codegenSessionId: 'session-1',
        status: 'PUBLISHED',
        publishedSnapshotId: 'snapshot-1',
        params: <String, String>{'symbol': 'BTC/USDT'},
        snapshotParamValues: <String, Object?>{},
        strategyConfig: <String, Object?>{},
        backtestConfigDefaults: <String, Object?>{},
        deploymentExecutionDefaults: <String, Object?>{},
        deploymentExecutionConstraints: <String, Object?>{},
        compatibilityMetadata: <String, Object?>{},
      );

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
  });

  testWidgets('就绪态：READY badge + 行号 + 成功提示，CTA 可点（验收 3、5）', (
    WidgetTester tester,
  ) async {
    await _pump(tester, strategyContext: publishedContext);
    await tester.pump();

    expect(find.byKey(const Key('ai-script-ready-badge')), findsOneWidget);
    expect(find.byKey(const Key('ai-script-success-hint')), findsOneWidget);
    // 行号：第 1 行存在。
    expect(find.text('1'), findsWidgets);

    final FilledButton next = tester.widget<FilledButton>(
      find.byKey(const Key('ai-script-next-cta')),
    );
    expect(next.onPressed, isNotNull, reason: '就绪态「下一步」可点');
  });

  testWidgets('仅有 PUBLISHED 字符串但缺少发布快照时 CTA 禁用', (WidgetTester tester) async {
    await _pump(tester, params: <String, String>{'codegenStatus': 'PUBLISHED'});
    await tester.pump();

    final FilledButton next = tester.widget<FilledButton>(
      find.byKey(const Key('ai-script-next-cta')),
    );
    expect(next.onPressed, isNull);
  });

  testWidgets('就绪态优先展示后端 scriptCode，不再使用本地 mock 模板', (
    WidgetTester tester,
  ) async {
    const String script = 'export default class RealStrategy {}';
    await _pump(
      tester,
      strategyContext: const AiPublishedStrategyContext(
        codegenSessionId: 'session-1',
        status: 'PUBLISHED',
        publishedSnapshotId: 'snapshot-1',
        scriptCode: script,
        params: <String, String>{'symbol': 'ETH/USDT'},
        snapshotParamValues: <String, Object?>{},
        strategyConfig: <String, Object?>{},
        backtestConfigDefaults: <String, Object?>{},
        deploymentExecutionDefaults: <String, Object?>{},
        deploymentExecutionConstraints: <String, Object?>{},
        compatibilityMetadata: <String, Object?>{},
      ),
    );
    await tester.pump();

    final Iterable<RichText> codeTexts = tester.widgetList<RichText>(
      find.byType(RichText),
    );
    expect(
      codeTexts.any(
        (RichText widget) => widget.text.toPlainText().contains('RealStrategy'),
      ),
      isTrue,
    );
    expect(find.textContaining('Quantify Strategy · 双均线趋势'), findsNothing);
  });

  testWidgets('长脚本：展开折叠切换文案「查看全部 N 行 / 收起」（验收 4）', (WidgetTester tester) async {
    await _pump(tester, params: <String, String>{'codegenStatus': 'PUBLISHED'});
    await tester.pump();

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
        'codegenStatus': 'PUBLISHED',
        'symbol': 'ETH/USDT',
        'file': 'eth_range_grid.js',
      },
    );
    await tester.pump();

    // recap badge + 终端头部均显示真实文件名。
    expect(find.text('eth_range_grid.js'), findsWidgets);
    expect(find.text('strategy.js'), findsNothing);
  });

  testWidgets('无 file 字段时由 symbol 派生文件名（验收 6）', (WidgetTester tester) async {
    await _pump(
      tester,
      params: <String, String>{
        'codegenStatus': 'PUBLISHED',
        'symbol': 'BTC/USDT',
      },
    );
    await tester.pump();
    expect(find.text('btc_trend_ma.js'), findsWidgets);
  });

  testWidgets('失败态：显示 codegen 错误且 CTA 禁用（#2310）', (WidgetTester tester) async {
    await _pump(
      tester,
      params: <String, String>{
        'codegenStatus': 'CONSISTENCY_FAILED',
        'codegenError': 'syntax mismatch',
      },
    );
    await tester.pump();

    expect(find.byKey(const Key('ai-script-error')), findsOneWidget);
    expect(find.textContaining('syntax mismatch'), findsOneWidget);
    final FilledButton next = tester.widget<FilledButton>(
      find.byKey(const Key('ai-script-next-cta')),
    );
    expect(next.onPressed, isNull);
  });

  test('脚本页 fallback 杠杆默认 5x（#2066）', () {
    expect(kStratFallbackParams['leverage'], '5x');
  });
}
