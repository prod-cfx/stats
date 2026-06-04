import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_chip.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_step_bar.dart';
import '../../widgets/qz_top_bar.dart';
import '../../widgets/qz_top_cancel_button.dart';
part 'ai_confirm_page.blocks.part.dart';
part 'ai_confirm_page.bottombar.part.dart';

/// AI 量化「确认策略」屏 — route `/ai/confirm`（#1832 / 内容对齐 #1891）。
///
/// 对齐设计稿 `design/project/mobile/m-screens-confirm.jsx#ScreenStratConfirm`：
///   - Hero 卡：spark icon + 策略名 + 副标题 + 4 chips（分类/交易对/周期/市场·杠杆）
///   - 策略逻辑区：IF/THEN RuleBlock（IF 橙 #D08A2A / THEN 蓝 #2A88D0），
///     多条规则间「AND AT THEN」分隔，区块标题右侧「在对话中修改」链接
///   - EXECUTE 块：交易所/标的/周期/仓位/市场 mono chips + 风控告警条
///   - AI 提示框（紫底 + bot icon）+ 免责声明条（shield）
///   - 底部双按钮「返回对话」/「下一步：策略脚本」，顶栏右侧「取消」
///
/// 流程条（#2130）：顶栏下方展示设计稿统一 [QzStepBar]，对齐
/// `m-screens-confirm.jsx` 的 `<BtcStepBar active={0} done={[]}/>`——确认页为
/// 第 1 步 active、done 为空。后续向导页（script / btconfig / ...）复用同组件
/// 推进 active/done。脚本预览块仍下沉到「策略脚本」目标屏（拆分 #1892）。
///
/// 入参：当前会话参数经 `extra` 透传（`Map<String, String>`）。缺省时回退
/// [_fallbackParams]，保证深链 / widget test 直接打开不崩。
class AiConfirmPage extends StatelessWidget {
  const AiConfirmPage({super.key, this.params});

  /// 当前会话参数键值对。来自参数气泡 `onConfirm` 接线（#1831），经 router
  /// `extra` 透传。`null` 时使用 [_fallbackParams]。
  final Map<String, String>? params;

  /// 直接深链打开（无会话上下文）时的兜底参数，对齐设计稿 BTC 趋势双均线。
  static const Map<String, String> _fallbackParams = <String, String>{
    'category': '趋势跟踪',
    'symbol': 'BTC/USDT',
    'period': '15m',
    'fast_ma': '5',
    'slow_ma': '20',
    'stop_loss': '2.0%',
    'leverage': '5x',
  };

  Map<String, String> get _params =>
      (params != null && params!.isNotEmpty) ? params! : _fallbackParams;

  // #1892 已落地 `/ai/script` 屏，「下一步：策略脚本」直接路由过去并透传会话参数。
  void _next(BuildContext context) =>
      context.push('/ai/script', extra: _params);

  void _backToChat(BuildContext context) => context.pop();

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final StrategyConfirmView view = confirmStrategyView(_params, l10n);
    return Scaffold(
      backgroundColor: c.bg,
      appBar: QzTopBar(
        title: l10n.aiConfirmStrategy,
        subtitle: l10n.aiConfirmSubtitle,
        onBack: () => context.pop(),
        actions: <Widget>[
          QzTopCancelButton(
            label: l10n.aiConfirmCancel,
            onTap: () => context.go('/ai'),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: <Widget>[
            QzStepBar(
              steps: <String>[
                l10n.aiStepConfirm,
                l10n.aiStepScript,
                l10n.aiStepBacktestConfig,
                l10n.aiStepBacktest,
                l10n.aiStepDeploy,
              ],
              active: 0,
            ),
            // 滚动区 + sticky 渐变操作区叠放（对齐设计稿 `position:absolute`）。
            Expanded(
              child: Stack(
                children: <Widget>[
                  // 内容滚动区：顶 12 / 左右 16 / 底 100（给 sticky bar 留空间，
                  // 滚动到底免责声明不被遮挡），对齐设计稿 `padding:12px 16px 100px`。
                  ListView(
                    padding: const EdgeInsets.fromLTRB(
                      QzSpacing.lg,
                      QzSpacing.md,
                      QzSpacing.lg,
                      100,
                    ),
                    children: <Widget>[
                      _HeroCard(
                        view: view,
                        subtitle: l10n.aiConfirmHeroSubtitle,
                      ),
                      const SizedBox(height: QzSpacing.lg),
                      _SectionTitle(
                        title: l10n.aiConfirmLogicTitle,
                        actionLabel: l10n.aiConfirmEditInChat,
                        onAction: () => context.pop(),
                      ),
                      const SizedBox(height: QzSpacing.sm),
                      for (int i = 0; i < view.rules.length; i++) ...<Widget>[
                        if (i > 0) _RuleSeparator(label: l10n.aiConfirmRuleSep),
                        _RuleBlock(
                          index: i,
                          rule: view.rules[i],
                          ifLabel: l10n.aiConfirmRuleIf,
                          thenLabel: l10n.aiConfirmRuleThen,
                        ),
                      ],
                      const SizedBox(height: QzSpacing.lg),
                      _ExecuteBlock(view: view),
                      const SizedBox(height: QzSpacing.lg),
                      _AiAdviceBox(
                        title: l10n.aiConfirmAdviceTitle,
                        text: view.advice,
                      ),
                      const SizedBox(height: QzSpacing.md),
                      _DisclaimerBar(text: l10n.aiConfirmDisclaimer),
                    ],
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: _BottomBar(
                      backLabel: l10n.aiConfirmBackToChat,
                      nextLabel: l10n.aiConfirmNextScript,
                      onBack: () => _backToChat(context),
                      onNext: () => _next(context),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 确认策略屏的结构化视图模型（由 params 派生，纯数据，便于测试）。
class StrategyConfirmView {
  const StrategyConfirmView({
    required this.name,
    required this.chips,
    required this.rules,
    required this.execute,
    required this.risks,
    required this.advice,
  });

  final String name;
  final List<({String label, QzChipTone tone})> chips;
  final List<({String iff, String then})> rules;
  final ({
    String exchange,
    String symbol,
    String period,
    String position,
    String market,
  })
  execute;
  final List<({String kind, String desc})> risks;
  final String advice;
}

/// 确认页支持的策略场景（对齐设计稿 `STRAT_SCENARIOS`）。
enum _ConfirmScenario { btcTrend, ethGrid }

/// 由会话参数推断展示场景（#2132）。
///
/// 设计稿确认页以「策略身份 + 场景内容」为核心，而非 `symbol + category` 自由拼接。
/// 优先取显式 `scenario` 字段；否则由 `category` / `symbol` 推断：
///   - 网格类（category 含「网格」或 symbol 为 ETH）→ ETH 网格场景
///   - 其余 → BTC 趋势双均线场景（默认）
_ConfirmScenario _scenarioOf(Map<String, String> params) {
  final String explicit = (params['scenario'] ?? '').toLowerCase();
  if (explicit == 'eth' || explicit == 'eth_grid') {
    return _ConfirmScenario.ethGrid;
  }
  if (explicit == 'btc' || explicit == 'btc_trend') {
    return _ConfirmScenario.btcTrend;
  }

  final String category = params['category'] ?? '';
  final String symbol = (params['symbol'] ?? '').toUpperCase();
  if (category.contains('网格') || symbol.startsWith('ETH')) {
    return _ConfirmScenario.ethGrid;
  }
  return _ConfirmScenario.btcTrend;
}

/// 由会话参数派生确认视图（对齐设计稿 `STRAT_SCENARIOS` 的策略身份与场景内容）。
///
/// 展示文案优先服从设计稿场景模板；仅 fast_ma / slow_ma / stop_loss 等业务参数
/// 做必要插值。纯静态标签（IF/THEN/EXECUTE 等）走 l10n。业务参数仍经 `extra`
/// 原样透传到 `/ai/script`，不受此展示映射影响（验收项 4）。
StrategyConfirmView confirmStrategyView(
  Map<String, String> params,
  AppLocalizations l10n,
) {
  return switch (_scenarioOf(params)) {
    _ConfirmScenario.ethGrid => _ethGridView(params),
    _ConfirmScenario.btcTrend => _btcTrendView(params),
  };
}

/// BTC 趋势 · 双均线场景（设计稿 `STRAT_SCENARIOS.btc`）。
StrategyConfirmView _btcTrendView(Map<String, String> params) {
  final String symbol = params['symbol'] ?? 'BTC/USDT';
  final String category = params['category'] ?? '趋势跟踪';
  final String period = params['period'] ?? '15m';
  final String fast = params['fast_ma'] ?? '5';
  final String slow = params['slow_ma'] ?? '20';
  final String stop = (params['stop_loss'] ?? '2.0%').replaceAll('%', '');
  final String leverage = params['leverage'] ?? '';
  final String market = leverage.isNotEmpty ? '合约 · $leverage' : '合约 · 5x';

  return StrategyConfirmView(
    name: 'BTC 趋势 · 双均线',
    chips: <({String label, QzChipTone tone})>[
      (label: category, tone: QzChipTone.accent),
      (label: symbol, tone: QzChipTone.neutral),
      (label: period, tone: QzChipTone.neutral),
      (label: market, tone: QzChipTone.info),
    ],
    rules: <({String iff, String then})>[
      (iff: 'MA$fast 上穿 MA$slow，且当前未持有任何方向仓位', then: '开多 100%'),
      (iff: 'MA$fast 下穿 MA$slow', then: '平多'),
      (iff: '持仓回撤 ≥ $stop% (触发追踪止损)', then: '强制平多'),
    ],
    execute: (
      exchange: 'OKX',
      symbol: symbol.replaceAll('/', ''),
      period: period,
      position: '100%',
      market: '永续合约',
    ),
    risks: <({String kind, String desc})>[
      (kind: '止损', desc: '价格相对入场均价下跌 $stop% → 强制平仓'),
      (kind: '止盈', desc: '价格相对入场均价上涨 0.6% → 平仓'),
    ],
    advice:
        '该策略在 BTC 4H/15m 上历史表现稳定，但在区间震荡市场可能出现频繁假突破。'
        '建议同时开启「ATR 过滤」减少噪音。',
  );
}

/// ETH 网格 · 区间震荡场景（设计稿 `STRAT_SCENARIOS.eth`）。
StrategyConfirmView _ethGridView(Map<String, String> params) {
  final String symbol = params['symbol'] ?? 'ETH/USDT';
  final String period = params['period'] ?? '1H';

  return StrategyConfirmView(
    name: 'ETH 网格 · 区间震荡',
    chips: <({String label, QzChipTone tone})>[
      (label: '网格', tone: QzChipTone.info),
      (label: symbol, tone: QzChipTone.neutral),
      (label: period, tone: QzChipTone.neutral),
      (label: '现货', tone: QzChipTone.info),
    ],
    rules: <({String iff, String then})>[
      (iff: '价格下穿任一网格线，且该网格尚未持仓', then: '分批买入 10% 仓位'),
      (iff: '价格上穿对应网格线 (该格已有持仓)', then: '平该格仓位获利'),
      (iff: '价格跌破区间下沿 ≥ 2%', then: '暂停网格 (等待人工恢复)'),
    ],
    execute: (
      exchange: 'OKX',
      symbol: symbol.replaceAll('/', ''),
      period: period.toLowerCase(),
      position: '10% / 格',
      market: '现货',
    ),
    risks: <({String kind, String desc})>[
      (kind: '区间', desc: '下沿 2,400 USDT / 上沿 3,000 USDT，共 10 格'),
      (kind: '熔断', desc: '价格跌破区间下沿 2% → 暂停网格'),
    ],
    advice:
        '该策略适合 ETH 在 2400-3000 区间震荡的行情。如出现单边趋势（尤其向下突破），'
        '会持续被动接货并产生浮亏，务必关注风控提示。',
  );
}

