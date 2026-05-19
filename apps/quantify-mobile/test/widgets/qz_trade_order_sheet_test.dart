import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_trade_order_sheet.dart';

/// 弹起 sheet 的脚手架：拿到 `pop` 时的 `TradeOrderResult` 用于断言提交回调。
Future<TradeOrderResult?> _openSheet(
  WidgetTester tester, {
  TradeDirection direction = TradeDirection.buy,
  double markPrice = 100,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 900));
  TradeOrderResult? captured;
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
                captured = await QzTradeOrderSheet.show(
                  ctx,
                  symbol: 'BTCUSDT',
                  direction: direction,
                  markPrice: markPrice,
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
  // captured 在 sheet pop 之后才赋值；调用方需要再 pumpAndSettle 一轮才能读到。
  // 这里返回 null 占位，断言 captured 时直接读上方闭包。
  return captured;
}

void main() {
  testWidgets('QzTradeOrderSheet 渲染默认限价 tab 与字段', (WidgetTester tester) async {
    await _openSheet(tester);

    // 默认价格预填 markPrice
    expect(find.text('100.00'), findsOneWidget);
    // 三段 tabs
    expect(find.text('限价'), findsOneWidget);
    expect(find.text('市价'), findsOneWidget);
    expect(find.text('条件委托'), findsOneWidget);
    // 杠杆默认 10x
    expect(find.text('10x'), findsOneWidget);
    // 提交按钮带方向 prefix + symbol
    expect(find.text('买入 BTCUSDT'), findsOneWidget);
    // 强平价占位
    expect(find.text('预计强平价'), findsOneWidget);
  });

  testWidgets('QzTradeOrderSheet tab 切换：市价价格字段禁用并显示市价提示', (
    WidgetTester tester,
  ) async {
    await _openSheet(tester);

    await tester.tap(find.text('市价'));
    await tester.pumpAndSettle();

    final TextField price = tester.widget<TextField>(
      find.descendant(
        of: find.byKey(const Key('trade-order-price')),
        matching: find.byType(TextField),
      ),
    );
    expect(price.enabled, isFalse);
    // 市价 hint
    expect(find.text('市价'), findsWidgets);
  });

  testWidgets('QzTradeOrderSheet 必填校验：未填数量时提交按钮禁用', (
    WidgetTester tester,
  ) async {
    await _openSheet(tester);
    // 限价 tab 默认有价格但无数量 → submit 禁用
    final Opacity opacity = tester.widget<Opacity>(
      find.descendant(
        of: find.byKey(const Key('trade-order-submit')),
        matching: find.byType(Opacity),
      ),
    );
    expect(opacity.opacity, lessThan(1.0));
  });

  testWidgets('QzTradeOrderSheet 提交：mock 延迟后 pop 返回 TradeOrderResult', (
    WidgetTester tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(420, 900));
    TradeOrderResult? captured;
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
                  captured = await QzTradeOrderSheet.show(
                    ctx,
                    symbol: 'BTCUSDT',
                    direction: TradeDirection.sell,
                    markPrice: 200,
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

    // 填入数量
    await tester.enterText(
      find.descendant(
        of: find.byKey(const Key('trade-order-amount')),
        matching: find.byType(TextField),
      ),
      '0.5',
    );
    await tester.pump();

    // 卖出方向按钮文案
    expect(find.text('卖出 BTCUSDT'), findsOneWidget);

    await tester.tap(find.byKey(const Key('trade-order-submit')));
    await tester.pump(); // setState 进入 submitting
    // 拨过 mock 时长
    await tester.pump(const Duration(milliseconds: 800));
    await tester.pumpAndSettle();

    expect(captured, isNotNull);
    expect(captured!.symbol, 'BTCUSDT');
    expect(captured!.direction, TradeDirection.sell);
    expect(captured!.kind, TradeOrderKind.limit);
    expect(captured!.amount, 0.5);
    expect(captured!.price, 200);
    expect(captured!.leverage, 10);
  });
}
