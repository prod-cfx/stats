import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/strategy_models.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/strategy/widgets/strategy_existing_run_sheet.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

void main() {
  testWidgets(
    'existing run sheet shows strategy info and returns view action',
    (WidgetTester tester) async {
      bool? viewDetail;
      const StrategyCard card = StrategyCard(
        id: 'ema-trend',
        name: 'EMA 趋势延续',
        description: 'fixture',
        author: 'Quantify 官方',
        pnlPercent: 8.41,
        subscribers: 587,
        tags: <String>['趋势'],
        category: StrategyCategory.trend,
        pair: 'BTC-USDT-SWAP',
        period: '近 15m',
      );
      const StrategyRunResult result = StrategyRunResult(
        strategyId: 'existing-ema',
        existing: true,
        name: 'EMA 趋势延续',
        symbol: 'BTC-USDT-SWAP',
        timeframe: '15m',
        status: 'running',
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('zh'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          theme: buildQzThemeData(
            const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
          ),
          home: Builder(
            builder: (BuildContext context) => Scaffold(
              body: Center(
                child: TextButton(
                  onPressed: () async {
                    viewDetail = await showStrategyExistingRunSheet(
                      context,
                      result: result,
                      fallbackCard: card,
                    );
                  },
                  child: const Text('open'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      expect(find.text('已存在相同策略'), findsOneWidget);
      expect(find.text('EMA 趋势延续'), findsOneWidget);
      expect(find.text('BTC-USDT-SWAP / 15m'), findsOneWidget);
      expect(find.text('运行中'), findsOneWidget);
      expect(find.text('查看策略详情'), findsOneWidget);
      expect(find.text('关闭'), findsOneWidget);

      await tester.tap(find.text('查看策略详情'));
      await tester.pumpAndSettle();

      expect(viewDetail, isTrue);
    },
  );
}
