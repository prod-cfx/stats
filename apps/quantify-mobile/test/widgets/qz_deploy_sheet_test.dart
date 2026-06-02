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
import 'package:quantify_mobile/widgets/qz_button.dart';
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
    String? apiPassphrase,
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
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 320));
  await tester.pump();
  // 测试本身通过 finder/动作驱动状态机并断言可见 UI；sheet 的 Future 在
  // 用例结束时才完成，captured 仅作为存在性占位，调用方无需读取。
  return captured;
}

void main() {
  testWidgets(
      'QzDeploySheet: 主流程为 confirm → deploying → success，确认页含可切换账户（#2064/#2065）',
      (WidgetTester tester) async {
    final _FakeApiKeyRepo repo = _FakeApiKeyRepo(<ExchangeApiKey>[
      ExchangeApiKey(
        id: 'k1',
        exchange: 'binance',
        label: '主账户',
        maskedKey: 'AKIA****1234',
        createdAt: DateTime.utc(2026),
      ),
      ExchangeApiKey(
        id: 'k2',
        exchange: 'binance',
        label: '子账户',
        maskedKey: 'AKIA****5678',
        createdAt: DateTime.utc(2026),
      ),
      ExchangeApiKey(
        id: 'k3',
        exchange: 'okx',
        label: 'OKX 账户',
        maskedKey: 'OKX****1234',
        createdAt: DateTime.utc(2026),
      ),
    ]);
    await _pumpSheet(tester, repo: repo);

    // 新版主流程首屏即 confirm；旧选所 / 授权 / 资金配置不在主流程。
    expect(find.text('部署前检查'), findsWidgets);
    expect(find.text('选择交易所'), findsNothing);
    expect(find.text('授权部署'), findsNothing);
    expect(find.text('资金配置'), findsNothing);
    expect(find.byKey(const Key('deploy-step-indicator')), findsOneWidget);
    expect(find.byKey(const Key('deploy-preflight-confirm')), findsOneWidget);
    expect(find.byKey(const Key('deploy-confirm-bill')), findsOneWidget);
    expect(find.text('累计净值'), findsOneWidget);
    expect(find.text('最大回撤'), findsOneWidget);
    expect(find.text('永续合约'), findsOneWidget);
    expect(find.byKey(const Key('deploy-account-select')), findsOneWidget);
    expect(find.text('主账户'), findsOneWidget);
    expect(find.text('OKX 账户'), findsNothing,
        reason: '账户下拉只显示所选交易所的账户');

    // 选择账户可下拉切换，并回写确认账单。
    await tester.tap(find.byKey(const Key('deploy-account-select')));
    await tester.pumpAndSettle();
    expect(find.text('子账户'), findsOneWidget);
    expect(find.text('OKX 账户'), findsNothing);
    await tester.tap(find.text('子账户').last);
    await tester.pumpAndSettle();
    expect(find.text('子账户'), findsOneWidget);

    // 等扫描跑完（3 × 360ms）→ 首轮失败（#1896 失败路径），「重新检测」可见
    await tester.pump(const Duration(milliseconds: 1200));
    await tester.pump();
    expect(find.text('3/3 未通过'), findsOneWidget);
    expect(find.byKey(const Key('deploy-preflight-recheck')), findsOneWidget);
    // 失败态确认按钮 disabled
    expect(
      tester
          .widget<QzButton>(find.byKey(const Key('deploy-preflight-confirm')))
          .onPressed,
      isNull,
    );

    // 「重新检测」→ 复检全通过
    await tester.tap(find.byKey(const Key('deploy-preflight-recheck')));
    await tester.pump(const Duration(milliseconds: 1200));
    await tester.pump();
    expect(find.text('3/3 通过'), findsOneWidget);

    // 「确认无误，立即部署」→ deploying 分步
    await tester.tap(find.byKey(const Key('deploy-preflight-confirm')));
    await tester.pump();
    expect(find.text('正在部署…'), findsOneWidget);
    expect(find.byKey(const Key('deploy-progress')), findsOneWidget);
    expect(find.byKey(const Key('deploy-step-0')), findsOneWidget);
    expect(find.byKey(const Key('deploy-step-4')), findsOneWidget);

    // 拨过 5 步 × 360ms + buffer → done
    await tester.pump(const Duration(milliseconds: 2200));
    await tester.pump();
    // sheet 标题与 hero 同文「部署成功」→ 2 处
    expect(find.text('部署成功'), findsNWidgets(2));
    // 完整详情卡 + 下一步入口
    expect(find.byKey(const Key('deploy-done-detail')), findsOneWidget);
    expect(find.text('5000 USDT'), findsOneWidget);
    expect(find.text('运行中'), findsOneWidget);
    // 启动时间行（#1896）
    expect(find.text('启动时间'), findsOneWidget);
    expect(find.byKey(const Key('deploy-next-live')), findsOneWidget);
    expect(find.byKey(const Key('deploy-next-notify')), findsOneWidget);
    expect(find.byKey(const Key('deploy-next-tune')), findsOneWidget);
    expect(find.byKey(const Key('deploy-finish')), findsOneWidget);
  });

  testWidgets('QzDeploySheet: 无已绑定账户时 confirm 预检查失败并提供去绑定 API 入口（#2064）',
      (WidgetTester tester) async {
    await _pumpSheet(tester, repo: _FakeApiKeyRepo.empty());

    expect(find.text('部署前检查'), findsWidgets);
    expect(find.text('选择交易所'), findsNothing);
    expect(find.byKey(const Key('deploy-confirm-bill')), findsOneWidget);
    expect(find.byKey(const Key('deploy-go-configure')), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 1200));
    await tester.pump();
    expect(find.text('3/3 未通过'), findsOneWidget);
    expect(
      tester
          .widget<QzButton>(find.byKey(const Key('deploy-preflight-confirm')))
          .onPressed,
      isNull,
    );

    await tester.tap(find.byKey(const Key('deploy-go-configure')));
    await tester.pumpAndSettle();

    expect(find.text('部署前检查'), findsNothing);
    expect(find.text('Binance API'), findsOneWidget);
  });

  testWidgets(
      'QzDeploySheet: 预检查扫描期间「确认部署」disabled，扫完全通过后可点（#2064）',
      (WidgetTester tester) async {
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

    // 扫描中：确认按钮 disabled
    final QzButton confirmScanning = tester.widget<QzButton>(
      find.byKey(const Key('deploy-preflight-confirm')),
    );
    expect(confirmScanning.onPressed, isNull,
        reason: '扫描进行中不应允许部署');

    // 扫完 → 首轮失败（#1896），确认仍 disabled
    await tester.pump(const Duration(milliseconds: 1200));
    await tester.pump();
    expect(
      tester
          .widget<QzButton>(find.byKey(const Key('deploy-preflight-confirm')))
          .onPressed,
      isNull,
      reason: '存在未通过项时不应允许部署',
    );

    // 「重新检测」→ 复检全通过后才允许部署
    await tester.tap(find.byKey(const Key('deploy-preflight-recheck')));
    await tester.pump(const Duration(milliseconds: 1200));
    await tester.pump();
    final QzButton confirmDone = tester.widget<QzButton>(
      find.byKey(const Key('deploy-preflight-confirm')),
    );
    expect(confirmDone.onPressed, isNotNull,
        reason: '复检全通过后应允许部署');
  });
}
