import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_api_key_repository.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/me/api_form_sheet.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Issue #1898：API 配置抽屉按交易所 meta 驱动动态表单。
///
/// 三家交易所形态：
/// - Binance：key 模式，Secret 标签 = `Secret`，无 Passphrase。
/// - OKX：key 模式，Secret 标签 = `Secret Key`，有 Passphrase。
/// - Hyperliquid：wallet 模式，主钱包地址 + Agent 私钥，无 API Key/Secret。
Future<void> _pumpSheet(WidgetTester tester, String exchange) async {
  await tester.binding.setSurfaceSize(const Size(420, 2400));
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
        apiKeyRepositoryProvider.overrideWithValue(MockApiKeyRepository()),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('zh'),
        theme: buildQzThemeData(QzTheme.fallback),
        home: Builder(
          builder: (BuildContext context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => showApiFormSheet(context, exchange: exchange),
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
  group('Binance — key 模式', () {
    testWidgets('权限区 4 行 + 提币禁止', (WidgetTester tester) async {
      await _pumpSheet(tester, 'Binance');
      await tester.drag(find.byType(ListView), const Offset(0, -800));
      await tester.pumpAndSettle();

      expect(find.text('读取账户与持仓'), findsOneWidget);
      expect(find.text('现货下单'), findsOneWidget);
      expect(find.text('合约下单'), findsOneWidget);
      expect(find.text('提币'), findsOneWidget);
      expect(find.text('必须关闭'), findsOneWidget);
    });

    testWidgets('Secret 标签为 Secret，无 Passphrase / 主钱包地址',
        (WidgetTester tester) async {
      await _pumpSheet(tester, 'Binance');

      expect(find.text('Secret'), findsOneWidget);
      expect(find.text('Secret Key'), findsNothing);
      expect(find.text('Passphrase'), findsNothing);
      expect(find.text('主钱包地址'), findsNothing);
    });

    testWidgets('底部按钮仅「取消 / 验证并保存」', (WidgetTester tester) async {
      await _pumpSheet(tester, 'Binance');

      expect(find.text('取消'), findsOneWidget);
      expect(find.text('验证并保存'), findsOneWidget);
      expect(find.text('测试连接'), findsNothing);
    });
  });

  group('OKX — key 模式 + Passphrase', () {
    testWidgets('显示 Passphrase，Secret 标签为 Secret Key',
        (WidgetTester tester) async {
      await _pumpSheet(tester, 'OKX');

      expect(find.text('Secret Key'), findsOneWidget);
      expect(find.text('Passphrase'), findsOneWidget);
      // 纯标签 'Secret' 不应单独出现（已被 Secret Key 取代）
      expect(find.text('主钱包地址'), findsNothing);
    });
  });

  group('Hyperliquid — wallet 模式', () {
    testWidgets('字段为主钱包地址 + Agent 私钥，无 API Key/Secret/Passphrase',
        (WidgetTester tester) async {
      await _pumpSheet(tester, 'Hyperliquid');

      expect(find.text('主钱包地址'), findsOneWidget);
      expect(find.text('Agent 私钥'), findsOneWidget);
      expect(find.text('API Key'), findsNothing);
      expect(find.text('Secret'), findsNothing);
      expect(find.text('Secret Key'), findsNothing);
      expect(find.text('Passphrase'), findsNothing);
    });

    testWidgets('权限区为 wallet 三行（永续/现货下单 + Agent 无权限）',
        (WidgetTester tester) async {
      await _pumpSheet(tester, 'Hyperliquid');
      await tester.drag(find.byType(ListView), const Offset(0, -800));
      await tester.pumpAndSettle();

      expect(find.text('读取账户与持仓'), findsOneWidget);
      expect(find.text('永续 / 现货下单'), findsOneWidget);
      expect(find.text('转账 / 提币'), findsOneWidget);
      expect(find.text('Agent 无权限'), findsOneWidget);
      // key 模式专属文案不应出现
      expect(find.text('合约下单'), findsNothing);
      expect(find.text('必须关闭'), findsNothing);
    });
  });
}
