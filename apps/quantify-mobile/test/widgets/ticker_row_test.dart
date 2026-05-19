import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/ticker_repository.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/market/widgets/ticker_row.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_avatar.dart';
import 'package:quantify_mobile/widgets/qz_stat_chip.dart';

class _StubTickerRepository implements TickerRepository {
  @override
  Future<List<Ticker>> listTickers() async => const <Ticker>[];

  @override
  Stream<Ticker> watchTicker(String symbol) =>
      const Stream<Ticker>.empty();
}

Future<void> _pump(WidgetTester tester, Widget child) async {
  await tester.binding.setSurfaceSize(const Size(420, 200));
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        tickerRepositoryProvider.overrideWithValue(_StubTickerRepository()),
      ],
      child: MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(QzTheme.fallback),
        home: Scaffold(body: child),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  const Ticker btcSpot = Ticker(
    symbol: 'BTCUSDT',
    price: 70000,
    changePercent: 2.5,
    volume24h: 2.13e10,
    kind: MarketKind.spot,
  );
  const Ticker ethSpot = Ticker(
    symbol: 'ETHUSDT',
    price: 3500.5,
    changePercent: -1.25,
    volume24h: 8.45e9,
    kind: MarketKind.spot,
  );

  /// 找出 TickerRow 内承载 symbol 拆分的 RichText：其 root TextSpan 的
  /// 第一个非 null 子文本以传入的 base 开头（用以排除 QzAvatar 内的 RichText）。
  List<String> symbolParts(WidgetTester tester, String base) {
    final Iterable<RichText> all = tester.widgetList<RichText>(
      find.byType(RichText),
    );
    for (final RichText rt in all) {
      final InlineSpan span = rt.text;
      if (span is! TextSpan) continue;
      final List<String> parts = <String>[];
      span.visitChildren((InlineSpan child) {
        if (child is TextSpan && child.text != null) {
          parts.add(child.text!);
        }
        return true;
      });
      if (parts.isNotEmpty && parts.first == base) {
        return parts;
      }
    }
    throw StateError('no symbol RichText starts with $base');
  }

  testWidgets('symbol 拆分为 base + 小字 / quote', (WidgetTester tester) async {
    await _pump(tester, const TickerRow(ticker: btcSpot));
    expect(symbolParts(tester, 'BTC'), <String>['BTC', ' / USDT']);
  });

  testWidgets('未识别 quote 时整串作为 base，不渲染小字 quote',
      (WidgetTester tester) async {
    const Ticker oddSymbol = Ticker(
      symbol: 'FOOBAR',
      price: 1.23,
      changePercent: 0,
      volume24h: 1000,
      kind: MarketKind.spot,
    );
    await _pump(tester, const TickerRow(ticker: oddSymbol));
    expect(symbolParts(tester, 'FOOBAR'), <String>['FOOBAR']);
  });

  testWidgets('三列布局：价格右对齐，涨跌 chip 位于行最右',
      (WidgetTester tester) async {
    await _pump(tester, const TickerRow(ticker: btcSpot));
    // 价格 Text 是 textAlign right。
    final Text priceText = tester.widget<Text>(find.text('70000.00'));
    expect(priceText.textAlign, TextAlign.right);
    // chip 中心 dx 应在价格中心 dx 右侧。
    final Offset priceCenter = tester.getCenter(find.text('70000.00'));
    final Offset chipCenter = tester.getCenter(find.byType(QzStatChip));
    expect(chipCenter.dx, greaterThan(priceCenter.dx));
  });

  testWidgets('展示 24H 量（Vol \$xx.xB/M 格式）', (WidgetTester tester) async {
    await _pump(tester, const TickerRow(ticker: btcSpot));
    // 2.13e10 -> $21.3B
    expect(find.text('Vol \$21.3B'), findsOneWidget);
  });

  testWidgets('头像应用资产专属 tone（BTC 橙）', (WidgetTester tester) async {
    await _pump(tester, const TickerRow(ticker: btcSpot));
    final QzAvatar avatar = tester.widget<QzAvatar>(find.byType(QzAvatar));
    expect(avatar.backgroundColor, const Color(0xFFF7931A));
  });

  testWidgets('头像应用资产专属 tone（ETH 蓝）', (WidgetTester tester) async {
    await _pump(tester, const TickerRow(ticker: ethSpot));
    final QzAvatar avatar = tester.widget<QzAvatar>(find.byType(QzAvatar));
    expect(avatar.backgroundColor, const Color(0xFF627EEA));
  });

  testWidgets('未识别资产头像回退到主题 accent (tone 为空)',
      (WidgetTester tester) async {
    const Ticker oddSymbol = Ticker(
      symbol: 'FOOBAR',
      price: 1.23,
      changePercent: 0,
      volume24h: 1000,
      kind: MarketKind.spot,
    );
    await _pump(tester, const TickerRow(ticker: oddSymbol));
    final QzAvatar avatar = tester.widget<QzAvatar>(find.byType(QzAvatar));
    expect(avatar.backgroundColor, isNull);
  });

  testWidgets('涨跌 chip 为 solid variant（涨）', (WidgetTester tester) async {
    await _pump(tester, const TickerRow(ticker: btcSpot));
    final QzStatChip chip =
        tester.widget<QzStatChip>(find.byType(QzStatChip));
    expect(chip.variant, QzStatChipVariant.solid);
    expect(chip.minWidth, 70);
    expect(find.text('+2.50%'), findsOneWidget);
  });

  testWidgets('涨跌 chip 为 solid variant（跌）', (WidgetTester tester) async {
    await _pump(tester, const TickerRow(ticker: ethSpot));
    final QzStatChip chip =
        tester.widget<QzStatChip>(find.byType(QzStatChip));
    expect(chip.variant, QzStatChipVariant.solid);
    expect(find.text('-1.25%'), findsOneWidget);
  });

  testWidgets('点击行触发 onTap', (WidgetTester tester) async {
    int taps = 0;
    await _pump(
      tester,
      TickerRow(ticker: ethSpot, onTap: () => taps++),
    );
    await tester.tap(find.byType(TickerRow));
    await tester.pump();
    expect(taps, 1);
  });
}
