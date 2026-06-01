import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_chip.dart';
import '../../widgets/qz_card.dart';
import '../../widgets/qz_top_bar.dart';

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
/// 形态决策（#1890 方案 B）：维持对话中心形态，**不引入 StepBar**；设计稿里的
/// `<BtcStepBar/>` 显式不落地。脚本预览块下沉到「策略脚本」目标屏（拆分 #1892）。
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
    'leverage': '1x',
  };

  Map<String, String> get _params =>
      (params != null && params!.isNotEmpty) ? params! : _fallbackParams;

  // #1892 已落地 `/ai/script` 屏，「下一步：策略脚本」直接路由过去并透传会话参数。
  void _next(BuildContext context) => context.push('/ai/script', extra: _params);

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
          _CancelButton(
            label: l10n.aiConfirmCancel,
            onTap: () => context.pop(),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: <Widget>[
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(QzSpacing.lg),
                children: <Widget>[
                  _HeroCard(view: view, subtitle: l10n.aiConfirmHeroSubtitle),
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
                  _AiAdviceBox(title: l10n.aiConfirmAdviceTitle, text: view.advice),
                  const SizedBox(height: QzSpacing.md),
                  _DisclaimerBar(text: l10n.aiConfirmDisclaimer),
                ],
              ),
            ),
            _BottomBar(
              backLabel: l10n.aiConfirmBackToChat,
              nextLabel: l10n.aiConfirmNextScript,
              onBack: () => _backToChat(context),
              onNext: () => _next(context),
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
  }) execute;
  final List<({String kind, String desc})> risks;
  final String advice;
}

/// 由会话参数派生确认视图（对齐设计稿 BTC 双均线场景模板）。
///
/// 规则 / 执行 / 风控 / 建议文案含参数插值（fast_ma / slow_ma / stop_loss），
/// 故在 Dart 侧拼装；纯静态标签（IF/THEN/EXECUTE 等）走 l10n。
StrategyConfirmView confirmStrategyView(
  Map<String, String> params,
  AppLocalizations l10n,
) {
  final String category = params['category'] ?? '趋势跟踪';
  final String symbol = params['symbol'] ?? 'BTC/USDT';
  final String period = params['period'] ?? '15m';
  final String fast = params['fast_ma'] ?? '5';
  final String slow = params['slow_ma'] ?? '20';
  final String stop = (params['stop_loss'] ?? '2.0%').replaceAll('%', '');
  final String leverage = params['leverage'] ?? '';
  final String market = leverage.isNotEmpty ? '合约 · $leverage' : '现货';

  return StrategyConfirmView(
    name: '$symbol $category',
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
      market: leverage.isNotEmpty ? '永续合约' : '现货',
    ),
    risks: <({String kind, String desc})>[
      (kind: '止损', desc: '价格相对入场均价下跌 $stop% → 强制平仓'),
      (kind: '止盈', desc: '价格相对入场均价上涨 0.6% → 平仓'),
    ],
    advice: '该策略在 $symbol $period 周期上历史表现稳定，但在区间震荡市场可能出现频繁假突破。'
        '建议同时开启「ATR 过滤」减少噪音。',
  );
}

/// 顶栏右侧「取消」按钮。
class _CancelButton extends StatelessWidget {
  const _CancelButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.only(right: QzSpacing.xs),
      child: TextButton(
        key: const Key('ai-confirm-cancel'),
        onPressed: onTap,
        style: TextButton.styleFrom(
          minimumSize: const Size(0, 30),
          padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
          foregroundColor: c.textMid,
          backgroundColor: c.bgElev,
          side: BorderSide(color: c.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(QzRadii.input),
          ),
        ),
        child: Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
        ),
      ),
    );
  }
}

/// Hero 卡：spark icon + 策略名 + 副标题 + 4 chips。
class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.view, required this.subtitle});

  final StrategyConfirmView view;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      key: const Key('ai-confirm-hero'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: c.accentSoft,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.auto_awesome, size: 20, color: c.accent),
              ),
              const SizedBox(width: QzSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      view.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(color: c.textDim, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Wrap(
            spacing: QzSpacing.xs,
            runSpacing: QzSpacing.xs,
            children: <Widget>[
              for (final ({String label, QzChipTone tone}) chip in view.chips)
                QzChip(label: chip.label, tone: chip.tone),
            ],
          ),
        ],
      ),
    );
  }
}

/// 区块标题 + 右侧动作链接（「在对话中修改」）。
class _SectionTitle extends StatelessWidget {
  const _SectionTitle({
    required this.title,
    required this.actionLabel,
    required this.onAction,
  });

  final String title;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      children: <Widget>[
        Text(
          title,
          style: TextStyle(
            color: c.textMid,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
        ),
        const Spacer(),
        InkWell(
          key: const Key('ai-confirm-edit-in-chat'),
          onTap: onAction,
          borderRadius: BorderRadius.circular(QzRadii.input),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.xs,
              vertical: 2,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(Icons.edit_outlined, size: 11, color: c.accent),
                const SizedBox(width: 3),
                Text(
                  actionLabel,
                  style: TextStyle(
                    color: c.accent,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// IF / THEN 规则块（IF 标签橙 / THEN 标签蓝，对齐设计稿）。
class _RuleBlock extends StatelessWidget {
  const _RuleBlock({
    required this.index,
    required this.rule,
    required this.ifLabel,
    required this.thenLabel,
  });

  // 设计稿固定标签色，不随主题反色。
  static const Color _ifColor = Color(0xFFD08A2A);
  static const Color _thenColor = Color(0xFF2A88D0);

  final int index;
  final ({String iff, String then}) rule;
  final String ifLabel;
  final String thenLabel;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      key: Key('ai-confirm-rule-$index'),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.md,
      ),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _label(ifLabel, _ifColor),
          const SizedBox(height: QzSpacing.xs),
          Text(
            rule.iff,
            style: TextStyle(color: c.text, fontSize: 13, height: 1.55),
          ),
          const SizedBox(height: QzSpacing.sm),
          _label(thenLabel, _thenColor),
          const SizedBox(height: QzSpacing.xs),
          Text(
            rule.then,
            style: TextStyle(
              color: c.text,
              fontSize: 13,
              height: 1.55,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(String text, Color color) => Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.2,
        ),
      );
}

/// 规则间分隔（「AND AT THEN」）。
class _RuleSeparator extends StatelessWidget {
  const _RuleSeparator({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: QzSpacing.sm),
      child: Center(
        child: Text(
          label,
          style: TextStyle(
            color: c.textDim,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.4,
          ),
        ),
      ),
    );
  }
}

/// EXECUTE 块：mono chips + 风控告警条列表。
class _ExecuteBlock extends StatelessWidget {
  const _ExecuteBlock({required this.view});

  final StrategyConfirmView view;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<({String k, String v})> chips = <({String k, String v})>[
      (k: l10n.aiConfirmExecExchange, v: view.execute.exchange),
      (k: l10n.aiConfirmExecSymbol, v: view.execute.symbol),
      (k: l10n.aiConfirmExecPeriod, v: view.execute.period),
      (k: l10n.aiConfirmExecPosition, v: view.execute.position),
      (k: l10n.aiConfirmExecMarket, v: view.execute.market),
    ];
    return Container(
      key: const Key('ai-confirm-execute'),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.md,
      ),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.aiConfirmExecuteTitle,
            style: TextStyle(
              color: c.accent,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: QzSpacing.sm),
          Wrap(
            spacing: QzSpacing.xs,
            runSpacing: QzSpacing.xs,
            children: <Widget>[
              for (final ({String k, String v}) chip in chips)
                _MonoChip(label: chip.k, value: chip.v),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          for (final ({String kind, String desc}) risk in view.risks) ...<Widget>[
            _RiskBar(kind: risk.kind, desc: risk.desc, badge: l10n.aiConfirmRiskBadge),
            const SizedBox(height: QzSpacing.xs),
          ],
        ],
      ),
    );
  }
}

/// EXECUTE 内的 mono key:value chip。
class _MonoChip extends StatelessWidget {
  const _MonoChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: QzSpacing.xxs),
      decoration: BoxDecoration(
        color: c.bgSoft,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(
            fontSize: 11.5,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
          children: <InlineSpan>[
            TextSpan(text: '$label: ', style: TextStyle(color: c.textDim)),
            TextSpan(
              text: value,
              style: TextStyle(color: c.text, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}

/// 风控告警条（橙色）。
class _RiskBar extends StatelessWidget {
  const _RiskBar({required this.kind, required this.desc, required this.badge});

  final String kind;
  final String desc;
  final String badge;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: QzSpacing.sm),
      decoration: BoxDecoration(
        color: c.statusWarn.withValues(alpha: 0.06),
        border: Border.all(color: c.statusWarn.withValues(alpha: 0.20)),
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: QzSpacing.xs, vertical: 1),
            decoration: BoxDecoration(
              color: c.statusWarn.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '$badge · $kind',
              style: TextStyle(
                color: c.statusWarn,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.4,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: Text(
              desc,
              style: TextStyle(color: c.text, fontSize: 12, height: 1.55),
            ),
          ),
        ],
      ),
    );
  }
}

/// AI 提示框（紫底 + bot icon）。
class _AiAdviceBox extends StatelessWidget {
  const _AiAdviceBox({required this.title, required this.text});

  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      key: const Key('ai-confirm-advice'),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: QzSpacing.md),
      decoration: BoxDecoration(
        color: c.accentSoft,
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: c.accent,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Icon(Icons.smart_toy_outlined, size: 14, color: c.accentOn),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  title,
                  style: TextStyle(
                    color: c.accent,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: QzSpacing.xxs),
                Text(
                  text,
                  style: TextStyle(color: c.text, fontSize: 12, height: 1.65),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 免责声明条（shield icon）。
class _DisclaimerBar extends StatelessWidget {
  const _DisclaimerBar({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      key: const Key('ai-confirm-disclaimer'),
      padding: const EdgeInsets.symmetric(vertical: QzSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.shield_outlined, size: 12, color: c.textDim),
          const SizedBox(width: QzSpacing.xs),
          Expanded(
            child: Text(
              text,
              style: TextStyle(color: c.textDim, fontSize: 11, height: 1.6),
            ),
          ),
        ],
      ),
    );
  }
}

/// 底部行动条：返回对话（ghost）+ 下一步：策略脚本（accent）。
class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.backLabel,
    required this.nextLabel,
    required this.onBack,
    required this.onNext,
  });

  final String backLabel;
  final String nextLabel;
  final VoidCallback onBack;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.sm,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: OutlinedButton(
              key: const Key('ai-confirm-back-cta'),
              onPressed: onBack,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                foregroundColor: c.text,
                side: BorderSide(color: c.border),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(QzRadii.card),
                ),
              ),
              child: Text(backLabel),
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            flex: 2,
            child: FilledButton(
              key: const Key('ai-confirm-next-cta'),
              onPressed: onNext,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                backgroundColor: c.accent,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(QzRadii.card),
                ),
              ),
              child: Text(nextLabel),
            ),
          ),
        ],
      ),
    );
  }
}
