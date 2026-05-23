import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/api_key_models.dart';
import 'package:quantify_mobile/data/models/deploy_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/api_key_repository.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/widgets/qz_deploy_sheet.dart';

/// 无 `Future.delayed` 的 fake repository，配合 widget test 避免 200ms timer
/// 阻塞。`empty` 构造模拟「未配置任何 API」状态。
class _FakeApiKeyRepo implements ApiKeyRepository {
  _FakeApiKeyRepo(this._keys);
  _FakeApiKeyRepo.empty() : _keys = <ExchangeApiKey>[];
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
  }) async =>
      throw UnimplementedError();

  @override
  Future<void> removeKey(String id) async => throw UnimplementedError();
}

Future<DeploymentResult?> _pumpSheet(
  WidgetTester tester, {
  required ApiKeyRepository repo,
}) async {
  await tester.binding.setSurfaceSize(const Size(400, 800));
  DeploymentResult? captured;
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        apiKeyRepositoryProvider.overrideWithValue(repo),
      ],
      child: MaterialApp(
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
                  captured = await QzDeploySheet.show(ctx);
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.byKey(const Key('open')));
  await tester.pumpAndSettle();
  // 测试本身通过 finder/动作驱动状态机并断言可见 UI；sheet 的 Future 在
  // 用例结束时才完成，captured 仅作为存在性占位，调用方无需读取。
  return captured;
}

void main() {
  testWidgets('QzDeploySheet: 已配置交易所 pickExchange → authorize → '
      'deploying → done 步骤切换可见', (WidgetTester tester) async {
    final _FakeApiKeyRepo repo = _FakeApiKeyRepo(<ExchangeApiKey>[
      ExchangeApiKey(
        id: 'k1',
        exchange: 'binance',
        label: '主账户',
        maskedKey: 'AKIA****1234',
        createdAt: DateTime.utc(2026),
      ),
    ]);
    await _pumpSheet(tester, repo: repo);

    // Step 1: 选择交易所 — 风控 banner、安全 footer、目录内 4 个交易所均可见
    expect(find.text('选择交易所'), findsOneWidget);
    expect(find.byKey(const Key('deploy-risk-banner')), findsOneWidget);
    expect(find.text('BINANCE'), findsOneWidget);
    expect(find.text('OKX'), findsOneWidget);
    expect(find.text('BYBIT'), findsOneWidget);
    expect(find.text('HYPERLIQUID'), findsOneWidget);
    // 已配置 / 未配置 状态徽章并存
    expect(find.text('已配置'), findsOneWidget);
    expect(find.text('未配置'), findsNWidgets(3));
    // 标签：推荐 / 链上
    expect(find.text('推荐'), findsOneWidget);
    expect(find.text('链上'), findsOneWidget);

    // 点 binance（已授权）→ 进入授权步（权限授权变体）
    await tester.tap(find.byKey(const Key('deploy-exchange-binance')));
    await tester.pumpAndSettle();
    expect(find.text('授权部署'), findsOneWidget);
    expect(find.text('现货下单'), findsOneWidget);
    expect(find.text('合约下单'), findsOneWidget);
    expect(find.text('读取余额'), findsOneWidget);

    // 点「同意并部署」→ 进入 deploying
    await tester.tap(find.byKey(const Key('deploy-confirm')));
    await tester.pump();
    expect(find.text('正在部署…'), findsOneWidget);
    expect(find.byKey(const Key('deploy-progress')), findsOneWidget);

    // 拨过 1.8s 部署时长 + 一帧 setState
    await tester.pump(const Duration(milliseconds: 1800));
    await tester.pump();
    expect(find.text('部署成功'), findsOneWidget);
    expect(find.textContaining('BINANCE · inst-'), findsOneWidget);
    expect(find.byKey(const Key('deploy-finish')), findsOneWidget);
  });

  testWidgets('QzDeploySheet: 未配置 API → 引导按钮可见且可点',
      (WidgetTester tester) async {
    await _pumpSheet(tester, repo: _FakeApiKeyRepo.empty());

    expect(find.text('选择交易所'), findsOneWidget);
    // 全部交易所未配置 → 兜底引导按钮可见
    expect(find.byKey(const Key('deploy-go-configure')), findsOneWidget);
  });

  testWidgets('QzDeploySheet: 点击「添加 API」直接打开 API 表单 sheet（issue #1648）',
      (WidgetTester tester) async {
    await _pumpSheet(tester, repo: _FakeApiKeyRepo.empty());

    await tester.tap(find.byKey(const Key('deploy-go-configure')));
    await tester.pumpAndSettle();

    expect(find.text('选择交易所'), findsNothing);
    expect(find.text('Binance API'), findsOneWidget);
    expect(find.text('API Key'), findsOneWidget);
    expect(find.text('Secret'), findsOneWidget);
  });

  testWidgets('QzDeploySheet: 选未授权交易所 → 展示 3 步授权引导、提币警告、'
      'consent checkbox（issue #1653）', (WidgetTester tester) async {
    // 只配置 binance，让 okx 走未授权流程。
    final _FakeApiKeyRepo repo = _FakeApiKeyRepo(<ExchangeApiKey>[
      ExchangeApiKey(
        id: 'k1',
        exchange: 'binance',
        label: '主账户',
        maskedKey: 'AKIA****1234',
        createdAt: DateTime.utc(2026),
      ),
    ]);
    await _pumpSheet(tester, repo: repo);

    await tester.tap(find.byKey(const Key('deploy-exchange-okx')));
    await tester.pumpAndSettle();

    // 3 步引导可见
    expect(find.text('授权步骤'), findsOneWidget);
    expect(find.text('在交易所创建 API Key'), findsOneWidget);
    expect(find.text('仅勾选「读取 + 现货/合约下单」'), findsOneWidget);
    expect(find.text('把 API Key / Secret 粘到 Quantify'), findsOneWidget);

    // 提币权限警告
    expect(find.byKey(const Key('deploy-withdraw-warning')), findsOneWidget);

    // consent + 主按钮 + 取消
    expect(find.byKey(const Key('deploy-consent')), findsOneWidget);
    expect(find.byKey(const Key('deploy-open-api-form')), findsOneWidget);
    expect(find.byKey(const Key('deploy-unauth-cancel')), findsOneWidget);
  });

  testWidgets('QzDeploySheet: 未授权流程 consent 未勾选时主按钮 disabled，'
      '勾选后点击打开 API 表单（验收 3、4）', (WidgetTester tester) async {
    final _FakeApiKeyRepo repo = _FakeApiKeyRepo(<ExchangeApiKey>[
      ExchangeApiKey(
        id: 'k1',
        exchange: 'binance',
        label: '主账户',
        maskedKey: 'AKIA****1234',
        createdAt: DateTime.utc(2026),
      ),
    ]);
    await _pumpSheet(tester, repo: repo);

    // 选 okx
    await tester.tap(find.byKey(const Key('deploy-exchange-okx')));
    await tester.pumpAndSettle();

    // 未勾 consent：点主按钮不应跳转 / 关闭弹层
    await tester.tap(find.byKey(const Key('deploy-open-api-form')));
    await tester.pumpAndSettle();
    expect(find.text('授权步骤'), findsOneWidget,
        reason: 'consent 未勾选时主按钮 disabled，弹层应保留在 authorize 步');

    // 勾选 consent
    await tester.tap(find.byKey(const Key('deploy-consent')));
    await tester.pumpAndSettle();

    // 再次点击主按钮 → deploy sheet 关闭 + API 表单弹起
    await tester.tap(find.byKey(const Key('deploy-open-api-form')));
    await tester.pumpAndSettle();

    expect(find.text('授权步骤'), findsNothing);
    // _openApiForm 用 catalog.name（首字母大写），传入 ApiFormSheet 后渲染
    // 「{exchange} API」标题；OKX 经 ApiFormSheet 还原即 'OKX API'。
    expect(find.text('OKX API'), findsOneWidget);
  });
}
