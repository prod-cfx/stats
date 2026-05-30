import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/strategy_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/strategy/widgets/strategy_search_overlay.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 把 overlay 直接挂在一个可弹出的 host route 上：tap host 按钮 push overlay，
/// 这样 overlay 自身的 `Navigator.pop` 有真实路由可弹。回调命中写入 captured。
Future<({List<String> openStrat, List<StrategyCategory> pickTag, List<String> applyQuery})> _pumpOverlay(
  WidgetTester tester, {
  Map<String, Object> prefs = const <String, Object>{},
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 2400));
  SharedPreferences.setMockInitialValues(prefs);
  final SharedPreferences sp = await SharedPreferences.getInstance();
  final List<String> openStrat = <String>[];
  final List<StrategyCategory> pickTag = <StrategyCategory>[];
  final List<String> applyQuery = <String>[];

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(sp),
      ],
      child: MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(
          const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
        ),
        home: Builder(
          builder: (BuildContext context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                key: const Key('host-open'),
                onPressed: () => Navigator.of(context).push<void>(
                  MaterialPageRoute<void>(
                    builder: (_) => StrategySearchOverlay(
                      onOpenStrat: openStrat.add,
                      onPickTag: pickTag.add,
                      onApplyQuery: applyQuery.add,
                    ),
                  ),
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.byKey(const Key('host-open')));
  await tester.pumpAndSettle();
  // 「猜你想跟」mock listMarket 200ms
  await tester.pump(const Duration(milliseconds: 250));
  await tester.pump();
  return (openStrat: openStrat, pickTag: pickTag, applyQuery: applyQuery);
}

Future<void> _enter(WidgetTester tester, String q) async {
  await tester.enterText(find.byKey(const Key('strategy-search-input')), q);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));
  await tester.pump();
}

void main() {
  testWidgets('空查询态：展示热门搜索 + 猜你想跟 (#1824)',
      (WidgetTester tester) async {
    await _pumpOverlay(tester);
    expect(find.text('热门搜索'.toUpperCase()), findsOneWidget);
    expect(find.text('猜你想跟'.toUpperCase()), findsOneWidget);
    // 热门词「网格」chip 存在
    expect(find.text('网格'), findsWidgets);
    // 无历史时不渲染清空按钮
    expect(
        find.byKey(const Key('strategy-search-clear-history')), findsNothing);
  });

  testWidgets('空查询态：有历史时展示历史 + 清空按钮可清空 (#1824)',
      (WidgetTester tester) async {
    await _pumpOverlay(
      tester,
      prefs: <String, Object>{
        'qz.strategy.searchHistory': <String>['资金费率套利', 'BTC 网格'],
      },
    );
    expect(find.text('搜索历史'.toUpperCase()), findsOneWidget);
    expect(find.text('资金费率套利'), findsWidgets);
    // 清空
    await tester.tap(find.byKey(const Key('strategy-search-clear-history')));
    await tester.pumpAndSettle();
    expect(find.text('搜索历史'.toUpperCase()), findsNothing);
  });

  testWidgets('有查询：命中作者 + 策略分段 (#1824)',
      (WidgetTester tester) async {
    await _pumpOverlay(tester);
    await _enter(tester, 'Alpha');
    // Alpha Hunter 作者行 + 至少一条策略命中行存在（按 key 定位，避免与输入框
    // 占位「搜索策略 · 币对 · 作者」文案冲突）。
    expect(
        find.byKey(const Key('strategy-search-author-Alpha Hunter')),
        findsOneWidget);
    expect(
        find.byWidgetPredicate((Widget w) {
          final Key? k = w.key;
          return k is ValueKey<String> &&
              k.value.startsWith('strategy-search-strat-');
        }),
        findsWidgets);
  });

  testWidgets('有查询：命中分类标签段 (#1824)',
      (WidgetTester tester) async {
    final result = await _pumpOverlay(tester);
    await _enter(tester, '网格');
    expect(
        find.byKey(const Key('strategy-search-tag-grid')), findsOneWidget);
    // 点击标签 → pop + onPickTag(grid)
    await tester.tap(find.byKey(const Key('strategy-search-tag-grid')));
    await tester.pumpAndSettle();
    expect(result.pickTag, <StrategyCategory>[StrategyCategory.grid]);
  });

  testWidgets('有查询：无命中显示空结果文案 (#1824)',
      (WidgetTester tester) async {
    await _pumpOverlay(tester);
    await _enter(tester, 'zzzzz-no-such-thing');
    expect(
        find.byKey(const Key('strategy-search-no-results')), findsOneWidget);
  });

  testWidgets('选中策略：回调 onOpenStrat + 写入历史 + pop (#1824)',
      (WidgetTester tester) async {
    final result = await _pumpOverlay(tester);
    await _enter(tester, 'Alpha');
    final Finder row = find.byWidgetPredicate((Widget w) {
      final Key? k = w.key;
      return k is ValueKey<String> &&
          k.value.startsWith('strategy-search-strat-');
    });
    expect(row, findsWidgets);
    await tester.tap(row.first);
    await tester.pumpAndSettle();
    expect(result.openStrat.length, 1);
    // 历史已写入 'Alpha'
    final SharedPreferences sp = await SharedPreferences.getInstance();
    expect(sp.getStringList('qz.strategy.searchHistory'), contains('Alpha'));
  });

  testWidgets('键盘提交自由文本：onApplyQuery + 写历史 + pop (#1824)',
      (WidgetTester tester) async {
    final result = await _pumpOverlay(tester);
    await tester.enterText(
        find.byKey(const Key('strategy-search-input')), '低回撤');
    await tester.pump();
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    expect(result.applyQuery, <String>['低回撤']);
    final SharedPreferences sp = await SharedPreferences.getInstance();
    expect(sp.getStringList('qz.strategy.searchHistory'), contains('低回撤'));
  });
}
