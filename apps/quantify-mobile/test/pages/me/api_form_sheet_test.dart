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

/// Issue #1649：API 表单权限区与按钮结构必须对齐设计稿 m-screens-4.jsx:1146-1190。
///
/// 设计稿：4 行权限（读取账户与持仓 / 现货下单 / 合约下单 / 提币）+ 底部「取消 / 验证并保存」。
Future<void> _pumpSheet(WidgetTester tester) async {
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
                onPressed: () => showApiFormSheet(context, exchange: 'Binance'),
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
  testWidgets('权限区与设计稿一致：4 行允许 + 提币禁止', (WidgetTester tester) async {
    await _pumpSheet(tester);

    // 权限区位于 ListView 下方，先滚到底部确保所有权限行都已 build。
    final Finder list = find.byType(ListView);
    await tester.drag(list, const Offset(0, -800));
    await tester.pumpAndSettle();

    // 3 行允许权限文案对齐设计稿
    expect(find.text('读取账户与持仓'), findsOneWidget);
    expect(find.text('现货下单'), findsOneWidget);
    expect(find.text('合约下单'), findsOneWidget);

    // 提币行存在且文案为「必须关闭」
    expect(find.text('提币'), findsOneWidget);
    expect(find.text('必须关闭'), findsOneWidget);

    // 原 5 行实现里的旧文案不应再出现
    expect(find.text('现货读'), findsNothing);
    expect(find.text('现货交易'), findsNothing);
    expect(find.text('合约读'), findsNothing);
    expect(find.text('合约交易'), findsNothing);
  });

  testWidgets('底部按钮仅有「取消 / 验证并保存」，无「测试连接」', (WidgetTester tester) async {
    await _pumpSheet(tester);

    expect(find.text('取消'), findsOneWidget);
    expect(find.text('验证并保存'), findsOneWidget);
    expect(find.text('测试连接'), findsNothing);
  });
}
