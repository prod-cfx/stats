import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_trade_order_sheet.dart';

/// 弹起 sheet 的脚手架：暴露 `captured` 闭包 + sheet ready 的 future。
class _SheetHandle {
  TradeOrderResult? captured;
}

Future<_SheetHandle> _openSheet(
  WidgetTester tester, {
  TradeDirection direction = TradeDirection.buy,
  double markPrice = 100,
  double availableBalance = 1000,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 900));
  final _SheetHandle handle = _SheetHandle();
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(
        const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
      ),
      home: Scaffold(
        body: Builder(
          builder: (BuildContext ctx) => Center(
            child: ElevatedButton(
              key: const Key('open'),
              onPressed: () async {
                handle.captured = await QzTradeOrderSheet.show(
                  ctx,
                  symbol: 'BTCUSDT',
                  direction: direction,
                  markPrice: markPrice,
                  availableBalance: availableBalance,
                );
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.byKey(const Key('open')));
  await tester.pumpAndSettle();
  return handle;
}

void main() {
  testWidgets('QzTradeOrderSheet 渲染 header / popover / 默认 tab', (
    WidgetTester tester,
  ) async {
    await _openSheet(tester);

    // header
    expect(find.text('买入 / 做多 BTC'), findsOneWidget);
    expect(find.text('BTCUSDT · 永续 · Binance'), findsOneWidget);
    // 默认保证金 = 全仓；默认杠杆按钮 10x
    expect(find.text('全仓'), findsOneWidget);
    expect(find.text('10x'), findsOneWidget);
    // 默认价格预填 markPrice
    expect(find.text('100.00'), findsWidgets);
    // 默认提交按钮文案 = 请选择数量（pct=0）
    expect(find.text('请选择数量'), findsOneWidget);
    // 风控提示
    expect(find.text('提交后由 AI 风控自动检查仓位与最大回撤'), findsOneWidget);
  });

  testWidgets('QzTradeOrderSheet 杠杆 popover：选 50x 后按钮更新', (
    WidgetTester tester,
  ) async {
    await _openSheet(tester);

    await tester.tap(find.byKey(const Key('trade-order-leverage-toggle')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('trade-order-leverage-grid')), findsOneWidget);

    await tester.tap(find.byKey(const Key('trade-order-leverage-50')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('trade-order-leverage-grid')), findsNothing);
    expect(find.text('50x'), findsOneWidget);
  });

  testWidgets('QzTradeOrderSheet 保证金 popover：切换为逐仓', (
    WidgetTester tester,
  ) async {
    await _openSheet(tester);

    await tester.tap(find.byKey(const Key('trade-order-margin-toggle')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('trade-order-margin-isolated')));
    await tester.pumpAndSettle();
    // 按钮 label 改为"逐仓"
    expect(find.text('逐仓'), findsOneWidget);
    expect(find.text('全仓'), findsNothing);
  });

  testWidgets('QzTradeOrderSheet 切到市价：价格输入消失 + 显示参考价提示', (
    WidgetTester tester,
  ) async {
    await _openSheet(tester);

    await tester.tap(find.byKey(const Key('trade-order-tab-market')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('trade-order-price')), findsNothing);
    // 市价提示文案
    expect(find.textContaining('市价立即成交'), findsOneWidget);
  });

  testWidgets('QzTradeOrderSheet 切到条件委托：显示触发价输入', (
    WidgetTester tester,
  ) async {
    await _openSheet(tester);

    await tester.tap(find.byKey(const Key('trade-order-tab-conditional')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('trade-order-trigger')), findsOneWidget);
  });

  testWidgets('QzTradeOrderSheet 百分比 slider 节点点击：50% 更新预估', (
    WidgetTester tester,
  ) async {
    await _openSheet(tester, availableBalance: 1000);

    await tester.tap(find.byKey(const Key('trade-order-pct-50')));
    await tester.pumpAndSettle();
    // 50% × 1000 = 500.00 USDT margin
    expect(find.text('500.00 USDT'), findsOneWidget);
  });

  testWidgets('QzTradeOrderSheet TP/SL toggle 显隐 + 预估行', (
    WidgetTester tester,
  ) async {
    await _openSheet(tester, availableBalance: 1000);

    // 默认不展示
    expect(find.byKey(const Key('trade-order-tp')), findsNothing);
    expect(find.text('止盈预计收益'), findsNothing);

    await tester.tap(find.byKey(const Key('trade-order-tpsl-toggle')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('trade-order-tp')), findsOneWidget);
    expect(find.byKey(const Key('trade-order-sl')), findsOneWidget);

    // 选 50%、填入 TP/SL → 出现预估行
    await tester.tap(find.byKey(const Key('trade-order-pct-50')));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.descendant(
        of: find.byKey(const Key('trade-order-tp')),
        matching: find.byType(TextField),
      ),
      '120',
    );
    await tester.enterText(
      find.descendant(
        of: find.byKey(const Key('trade-order-sl')),
        matching: find.byType(TextField),
      ),
      '80',
    );
    await tester.pumpAndSettle();
    expect(find.text('止盈预计收益'), findsOneWidget);
    expect(find.text('止损预计损失'), findsOneWidget);
  });

  testWidgets('QzTradeOrderSheet 提交：50% pct → pop 返回 result', (
    WidgetTester tester,
  ) async {
    final _SheetHandle handle = await _openSheet(
      tester,
      direction: TradeDirection.sell,
      markPrice: 200,
      availableBalance: 1000,
    );

    // 选 50% 后按钮启用 + 文案变更
    await tester.tap(find.byKey(const Key('trade-order-pct-50')));
    await tester.pumpAndSettle();
    // margin = 1000 × 50% = 500；notional = 500 × 10 = 5000；amount = 5000/200 = 25
    expect(find.text('确认卖出 25.0000 BTC'), findsOneWidget);

    await tester.tap(find.byKey(const Key('trade-order-submit')));
    await tester.pump(); // 进入 submitting
    await tester.pump(const Duration(milliseconds: 800));
    await tester.pumpAndSettle();

    expect(handle.captured, isNotNull);
    expect(handle.captured!.symbol, 'BTCUSDT');
    expect(handle.captured!.direction, TradeDirection.sell);
    expect(handle.captured!.kind, TradeOrderKind.limit);
    expect(handle.captured!.leverage, 10);
    expect(handle.captured!.amount, closeTo(25, 0.0001));
    expect(handle.captured!.price, 200);
  });

  testWidgets('QzTradeOrderSheet 提交按钮：pct=0 时禁用', (
    WidgetTester tester,
  ) async {
    await _openSheet(tester);
    final Opacity opacity = tester.widget<Opacity>(
      find.descendant(
        of: find.byKey(const Key('trade-order-submit')),
        matching: find.byType(Opacity),
      ),
    );
    expect(opacity.opacity, lessThan(1.0));
  });
}
