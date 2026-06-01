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
  await tester.pumpAndSettle();
  // 测试本身通过 finder/动作驱动状态机并断言可见 UI；sheet 的 Future 在
  // 用例结束时才完成，captured 仅作为存在性占位，调用方无需读取。
  return captured;
}

void main() {
  testWidgets(
      'QzDeploySheet: 已配置交易所 pickExchange → authorize → allocate → '
      'preflight → deploying(分步) → done(详情卡) 全链路可见（#1772）',
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

    // Step 1: 选择交易所 — 风控 banner、安全 footer、目录内 4 个交易所均可见
    expect(find.text('选择交易所'), findsOneWidget);
    expect(find.byKey(const Key('deploy-risk-banner')), findsOneWidget);
    expect(find.text('BINANCE'), findsOneWidget);
    expect(find.text('OKX'), findsOneWidget);
    expect(find.text('BYBIT'), findsOneWidget);
    expect(find.text('HYPERLIQUID'), findsOneWidget);
    expect(find.text('已配置'), findsOneWidget);
    expect(find.text('未配置'), findsNWidgets(3));
    expect(find.text('推荐'), findsOneWidget);
    expect(find.text('链上'), findsOneWidget);

    // 点 binance（已授权）→ 进入授权步
    await tester.tap(find.byKey(const Key('deploy-exchange-binance')));
    await tester.pumpAndSettle();
    expect(find.text('授权部署'), findsOneWidget);
    expect(find.text('现货下单'), findsOneWidget);

    // 点「同意并部署」→ 进入资金配置（#1772）
    await tester.tap(find.byKey(const Key('deploy-confirm')));
    await tester.pumpAndSettle();
    expect(find.text('资金配置'), findsOneWidget);
    expect(find.byKey(const Key('deploy-allocate-amount')), findsOneWidget);
    expect(find.byKey(const Key('deploy-allocate-per-trade')), findsOneWidget);
    expect(find.byKey(const Key('deploy-allocate-max-loss')), findsOneWidget);
    expect(find.byKey(const Key('deploy-allocate-notify')), findsOneWidget);
    // #1796：单笔上限/日内亏损为滑块，通知拆 3 个分渠道开关
    expect(find.byType(Slider), findsNWidgets(2));
    expect(
      find.byKey(const Key('deploy-allocate-notify-open')),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('deploy-allocate-notify-close')),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('deploy-allocate-notify-stop-loss')),
      findsOneWidget,
    );
    expect(find.byType(Switch), findsNWidgets(3));
    // 步骤指示可见（authorize=1/5 起）
    expect(find.byKey(const Key('deploy-step-indicator')), findsOneWidget);

    // MAX 快捷比例 → 10000 USDT
    await tester.tap(find.byKey(const Key('deploy-allocate-pct-100')));
    await tester.pumpAndSettle();
    expect(find.text('\$10000 USDT'), findsOneWidget);

    // 「下一步」→ 预检查（只读账单确认 + 失败路径，#1896）
    await tester.tap(find.byKey(const Key('deploy-allocate-next')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('deploy-preflight-confirm')), findsOneWidget);
    expect(find.byKey(const Key('deploy-preflight-row-0')), findsOneWidget);
    expect(find.byKey(const Key('deploy-preflight-row-2')), findsOneWidget);
    // 只读账单卡：summary 3 格 + 只读表单 + footnote
    expect(find.byKey(const Key('deploy-confirm-bill')), findsOneWidget);
    expect(find.text('累计净值'), findsOneWidget);
    expect(find.text('最大回撤'), findsOneWidget);
    expect(find.text('永续合约'), findsOneWidget);

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
    expect(find.text('10000 USDT'), findsOneWidget);
    expect(find.text('运行中'), findsOneWidget);
    // 启动时间行（#1896）
    expect(find.text('启动时间'), findsOneWidget);
    expect(find.byKey(const Key('deploy-next-live')), findsOneWidget);
    expect(find.byKey(const Key('deploy-next-notify')), findsOneWidget);
    expect(find.byKey(const Key('deploy-next-tune')), findsOneWidget);
    expect(find.byKey(const Key('deploy-finish')), findsOneWidget);
  });

  testWidgets(
      'QzDeploySheet: 资金配置滑块可拖动、分渠道通知开关可独立切换（#1796）',
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

    await tester.tap(find.byKey(const Key('deploy-exchange-binance')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('deploy-confirm')));
    await tester.pumpAndSettle();

    // 默认：单笔 20%、日内亏损 -10%
    expect(find.text('20%'), findsOneWidget);
    expect(find.text('-10%'), findsOneWidget);

    // 拖动单笔上限滑块 → 值变化（具体落点取决于轨道宽度，断言不再是默认 20%）
    final Finder perTradeSlider = find.descendant(
      of: find.byKey(const Key('deploy-allocate-per-trade')),
      matching: find.byType(Slider),
    );
    await tester.drag(perTradeSlider, const Offset(80, 0));
    await tester.pumpAndSettle();
    expect(find.text('20%'), findsNothing);

    // 关闭「开仓时通知」开关 → 该行 Switch 变 false，另两个不受影响
    final Finder openSwitch = find.descendant(
      of: find.byKey(const Key('deploy-allocate-notify-open')),
      matching: find.byType(Switch),
    );
    expect(tester.widget<Switch>(openSwitch).value, isTrue);
    await tester.tap(openSwitch);
    await tester.pumpAndSettle();
    expect(tester.widget<Switch>(openSwitch).value, isFalse);

    final Finder closeSwitch = find.descendant(
      of: find.byKey(const Key('deploy-allocate-notify-close')),
      matching: find.byType(Switch),
    );
    expect(tester.widget<Switch>(closeSwitch).value, isTrue);
  });

  testWidgets(
      'QzDeploySheet: 预检查扫描期间「确认部署」disabled，扫完全通过后可点（#1772）',
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

    await tester.tap(find.byKey(const Key('deploy-exchange-binance')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('deploy-confirm')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('deploy-allocate-next')));
    await tester.pump(); // 进入 preflight，扫描开始

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
