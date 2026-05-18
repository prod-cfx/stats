import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_api_key_repository.dart';
import 'package:quantify_mobile/data/models/api_key_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/api_key_repository.dart';
import 'package:quantify_mobile/data/utils/mask_helpers.dart';
import 'package:quantify_mobile/pages/me/api_settings_page.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// 无 `Future.delayed` 的 fake repository，用于 widget test 避免 fake clock
/// 与真实 timer 失同步导致的 10min timeout。生产路径仍走 MockApiKeyRepository
/// 的 200ms 模拟。
class _ImmediateApiKeyRepository implements ApiKeyRepository {
  _ImmediateApiKeyRepository(this._keys);
  final List<ExchangeApiKey> _keys;

  @override
  Future<List<ExchangeApiKey>> listKeys() async =>
      List<ExchangeApiKey>.unmodifiable(_keys);

  @override
  Future<ExchangeApiKey> addKey({
    required String exchange,
    required String label,
    required String apiKey,
    required String apiSecret,
  }) async {
    final ExchangeApiKey entry = ExchangeApiKey(
      id: 'key-${_keys.length + 1}',
      exchange: exchange,
      label: label,
      maskedKey: maskApiKey(apiKey),
      createdAt: DateTime.utc(2026),
    );
    _keys.add(entry);
    return entry;
  }

  @override
  Future<void> removeKey(String id) async {
    _keys.removeWhere((ExchangeApiKey k) => k.id == id);
  }
}

Future<ProviderContainer> _pumpApi(
  WidgetTester tester, {
  QzTheme theme = QzTheme.fallback,
  ApiConnectionTester? tester0,
  ApiKeyRepository? repo,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 2000));
  final ApiKeyRepository repository = repo ?? MockApiKeyRepository();
  final ProviderContainer container = ProviderContainer(
    overrides: <Override>[
      apiKeyRepositoryProvider.overrideWithValue(repository),
      if (tester0 != null)
        apiConnectionTesterProvider.overrideWithValue(tester0),
    ],
  );
  // M6 修复：每个 testWidgets 结束时 dispose 容器，避免 9 主题循环创建
  // 9 个容器全部泄漏，污染后续 test。
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(theme),
        home: const ApiSettingsPage(),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return container;
}

void main() {
  testWidgets('渲染 3 个交易所槽位（Binance/OKX/Hyperliquid）',
      (WidgetTester tester) async {
    await _pumpApi(tester);
    expect(find.text('Binance'), findsOneWidget);
    expect(find.text('OKX'), findsOneWidget);
    expect(find.text('Hyperliquid'), findsOneWidget);
  });

  testWidgets('已配置 → 显示「管理」+ maskedKey；未配置 → 显示「连接」+ 「未配置」',
      (WidgetTester tester) async {
    await _pumpApi(tester);
    // fixture 已有 Binance (id key-1, maskedKey AKIA****1234) + OKX
    expect(find.text('管理'), findsNWidgets(2));
    expect(find.text('连接'), findsOneWidget);
    expect(find.text('AKIA****1234'), findsOneWidget);
    expect(find.textContaining('未配置'), findsOneWidget);
  });

  testWidgets('点击「连接」打开 sheet（包含 API Key / Secret / 备注）',
      (WidgetTester tester) async {
    await _pumpApi(tester);
    await tester.tap(find.text('连接'));
    await tester.pumpAndSettle();
    expect(find.text('Hyperliquid API'), findsOneWidget);
    expect(find.text('API Key'), findsOneWidget);
    expect(find.text('Secret'), findsOneWidget);
    expect(find.text('备注'), findsOneWidget);
    expect(find.text('测试连接'), findsOneWidget);
    expect(find.text('验证并保存'), findsOneWidget);
  });

  testWidgets('表单空提交 → 错误提示，长度 < 16 → 错误提示',
      (WidgetTester tester) async {
    await _pumpApi(tester);
    await tester.tap(find.text('连接'));
    await tester.pumpAndSettle();

    // 空提交
    await tester.tap(find.text('验证并保存'));
    await tester.pumpAndSettle();
    expect(find.text('请输入API Key'), findsOneWidget);
    expect(find.text('请输入Secret'), findsOneWidget);

    // 输入 < 16
    await tester.enterText(find.byType(TextFormField).at(0), 'short');
    await tester.enterText(find.byType(TextFormField).at(1), 'short');
    await tester.tap(find.text('验证并保存'));
    await tester.pumpAndSettle();
    expect(find.text('API Key 至少 16 位'), findsOneWidget);
    expect(find.text('Secret 至少 16 位'), findsOneWidget);
  });

  testWidgets('测试连接（注入 true，立即返回）→ SnackBar 显示「连接成功」',
      (WidgetTester tester) async {
    // 注入「无延迟」的 tester，避免 fake clock 与真实 Future.delayed 失同步。
    await _pumpApi(tester, tester0: () async => true);
    await tester.tap(find.text('连接'));
    await tester.pumpAndSettle();
    // 确保「测试连接」按钮在可视区内，否则 tap() 在 fake render 下可能 miss。
    await tester.ensureVisible(find.text('测试连接'));
    await tester.enterText(
      find.byType(TextFormField).at(0),
      'AAAAAAAAAAAAAAAAAAAAAAAA',
    );
    await tester.enterText(
      find.byType(TextFormField).at(1),
      'BBBBBBBBBBBBBBBBBBBBBBBB',
    );
    await tester.tap(find.text('测试连接'));
    // 注入的 tester0 是无延迟的 Future，所以一帧即可拿到结果。
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300)); // SnackBar 入场动画
    expect(find.text('连接成功'), findsOneWidget);
    // 让 SnackBar 自动消失，避免 timer 泄漏到下一个 test。
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets(
      'widget-level 完整保存流程：连接 → 填合法值 → 验证并保存 → sheet 关闭 + 列表刷新展示新行（apiKeysProvider 失效 → 列表 invalidate）',
      (WidgetTester tester) async {
    // 用 _ImmediateApiKeyRepository（无 Future.delayed）跑完整 widget 路径，
    // 避免 fake clock 与 mock 200ms 真实 timer 失同步。
    final _ImmediateApiKeyRepository repo = _ImmediateApiKeyRepository(
      <ExchangeApiKey>[
        ExchangeApiKey(
          id: 'k1',
          exchange: 'binance',
          label: '主账户',
          maskedKey: 'AKIA****1234',
          createdAt: DateTime.utc(2026),
        ),
        ExchangeApiKey(
          id: 'k2',
          exchange: 'okx',
          label: '主账户',
          maskedKey: 'OKX-****5678',
          createdAt: DateTime.utc(2026),
        ),
      ],
    );
    await _pumpApi(tester, tester0: () async => true, repo: repo);

    // 进入前 Hyperliquid 未配置
    expect(find.text('连接'), findsOneWidget);
    expect(find.text('管理'), findsNWidgets(2));

    await tester.tap(find.text('连接'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('验证并保存'));

    await tester.enterText(
      find.byType(TextFormField).at(0),
      'HYPER_KEY_AAAAAAAAAAAAA',
    );
    await tester.enterText(
      find.byType(TextFormField).at(1),
      'HYPER_SECRET_BBBBBBBBB',
    );
    await tester.tap(find.text('验证并保存'));
    await tester.pumpAndSettle();

    // sheet 已关闭
    expect(find.text('测试连接'), findsNothing);
    // apiKeysProvider invalidate 后 page 重新 build：新行 maskedKey 展示
    expect(find.text('HYPE****AAAA'), findsOneWidget);
    // 三个槽位都已配置
    expect(find.text('管理'), findsNWidgets(3));
    expect(find.text('连接'), findsNothing);
  });

  test('提交合法表单（unit） → addKey() 新签名生成 maskedKey 并入库', () async {
    // 用纯 unit test 而不是 widget test：mock repository 的 200ms 真实
    // `Future.delayed` 与 widget test 的 fake clock 不兼容，会 10min timeout。
    final MockApiKeyRepository repo = MockApiKeyRepository();
    final ExchangeApiKey added = await repo.addKey(
      exchange: 'Hyperliquid',
      label: '主账户',
      apiKey: 'AAAAAAAAAAAAAAAAAAAAAAAA',
      apiSecret: 'BBBBBBBBBBBBBBBBBBBBBBBB',
    );
    expect(added.exchange, 'Hyperliquid');
    expect(added.maskedKey, 'AAAA****AAAA');
    final List<ExchangeApiKey> keys = await repo.listKeys();
    expect(
      keys.any((ExchangeApiKey k) =>
          k.exchange.toLowerCase() == 'hyperliquid'),
      isTrue,
    );
  });

  testWidgets('9 主题循环 pump 不抛异常', (WidgetTester tester) async {
    expect(
      QzBg.values.length * QzAccent.values.length,
      9,
      reason: '主题枚举数量变了，更新 api_settings_page_test',
    );
    for (final QzBg bg in QzBg.values) {
      for (final QzAccent acc in QzAccent.values) {
        await _pumpApi(tester, theme: QzTheme(bg: bg, accent: acc));
        expect(tester.takeException(), isNull);
      }
    }
  });
}
