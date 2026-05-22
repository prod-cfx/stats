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
  testWidgets('QzDeploySheet: pickExchange → authorize → deploying → done '
      '步骤切换可见', (WidgetTester tester) async {
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

    // Step 1: 选择交易所
    expect(find.text('选择交易所'), findsOneWidget);
    expect(find.text('BINANCE'), findsOneWidget);
    expect(find.text('已配置'), findsOneWidget);

    // 点 binance → 进入授权步
    await tester.tap(find.byKey(const Key('deploy-exchange-k1')));
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
    expect(
      find.text('尚未配置任何交易所 API，添加后再试。'),
      findsOneWidget,
    );
    expect(find.byKey(const Key('deploy-go-configure')), findsOneWidget);
  });

  testWidgets('QzDeploySheet: 点击「添加 API」直接打开 API 表单 sheet（issue #1648）',
      (WidgetTester tester) async {
    // 入口统一为底部表单：未配置时点击引导按钮应先关闭 deploy sheet，
    // 再打开 Binance API 表单 bottom sheet，不再跳转独立列表页。
    await _pumpSheet(tester, repo: _FakeApiKeyRepo.empty());

    await tester.tap(find.byKey(const Key('deploy-go-configure')));
    await tester.pumpAndSettle();

    // deploy sheet 已关闭：标题不再可见
    expect(find.text('选择交易所'), findsNothing);
    // API 表单 sheet 弹出：标题 / 字段可见
    expect(find.text('Binance API'), findsOneWidget);
    expect(find.text('API Key'), findsOneWidget);
    expect(find.text('Secret'), findsOneWidget);
  });
}
