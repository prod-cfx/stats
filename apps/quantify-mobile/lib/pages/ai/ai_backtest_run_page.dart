import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/backtest_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import 'widgets/qz_backtest_progress_card.dart';
import '../../widgets/qz_step_bar.dart';
import '../../widgets/qz_top_bar.dart';
import '../../widgets/qz_top_cancel_button.dart';

/// AI 量化「回测进行中」整屏页 — 向导第 4 步。
class AiBacktestRunPage extends ConsumerStatefulWidget {
  const AiBacktestRunPage({super.key, this.params});

  final Map<String, String>? params;

  @override
  ConsumerState<AiBacktestRunPage> createState() => _AiBacktestRunPageState();
}

class _AiBacktestRunPageState extends ConsumerState<AiBacktestRunPage> {
  double _progress = 0.38;
  Object? _error;

  Map<String, String> get _params => widget.params ?? const <String, String>{};

  String get _symbol => _normalizeBacktestSymbol(
    _params['symbol'] ?? _params['symbols'] ?? 'BTCUSDT',
  );

  String get _baseTimeframe =>
      _params['baseTimeframe'] ?? _params['period'] ?? '15m';

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_runBacktest);
  }

  Future<void> _runBacktest() async {
    try {
      final DateTime end = _resolveEnd(_params);
      final DateTime start = _resolveStart(_params, end);
      final String snapshotId = _params['publishedSnapshotId']?.trim() ?? '';
      if (snapshotId.isEmpty) {
        throw const FormatException('缺少已发布策略快照，无法发起回测。请返回确认策略后重试。');
      }
      final BacktestResult result = await ref
          .read(backtestRepositoryProvider)
          .run(
            BacktestRequest(
              strategyId:
                  _params['strategyInstanceId']?.trim().isNotEmpty == true
                  ? _params['strategyInstanceId']!.trim()
                  : snapshotId,
              publishedSnapshotId: snapshotId,
              conversationId:
                  _params['conversationId'] ?? _params['codegenSessionId'],
              symbol: _symbol,
              baseTimeframe: _baseTimeframe,
              startTime: start,
              endTime: end,
              initialCash:
                  double.tryParse(_params['backtestInitialCash'] ?? '') ??
                  10000,
              marketType: _params['backtestMarketType'] == 'spot'
                  ? 'spot'
                  : 'perp',
              leverage:
                  int.tryParse(_params['backtestLeverage'] ?? '') ??
                  int.tryParse((_params['leverage'] ?? '').replaceAll('x', '')),
              slippageBps:
                  double.tryParse(_params['backtestSlippageBps'] ?? '') ?? 5,
              feeBps: double.tryParse(_params['backtestFeeBps'] ?? '') ?? 2,
              priceSource: _normalizePriceSource(
                _params['backtestPriceSource'] ?? 'close',
              ),
              allowPartial: _params['backtestAllowPartial'] != 'false',
              rangePreset: _params['backtestRangePreset'] ?? '30D',
              params: <String, dynamic>{..._params},
            ),
          );
      if (!mounted) return;
      setState(() => _progress = 1);
      context.pushReplacement(
        '/ai/backtest-result?jobId=${Uri.encodeComponent(result.id)}',
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final c = context.qzScheme;
    return Scaffold(
      backgroundColor: c.bg,
      appBar: QzTopBar(
        title: '回测进行中',
        subtitle: '${_symbol.replaceAll('USDT', '/USDT')} · $_baseTimeframe',
        onBack: () => context.pop(),
        actions: <Widget>[
          QzTopCancelButton(
            label: l10n.commonCancel,
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
              active: 3,
              done: const <int>[0, 1, 2],
            ),
            Expanded(
              child: Stack(
                children: <Widget>[
                  ListView(
                    padding: const EdgeInsets.fromLTRB(
                      QzSpacing.lg,
                      QzSpacing.md,
                      QzSpacing.lg,
                      100,
                    ),
                    children: <Widget>[
                      if (_error == null)
                        QzBacktestProgressCard(progress: _progress)
                      else
                        Text('${l10n.commonLoadError}: $_error'),
                    ],
                  ),
                  Positioned(
                    left: QzSpacing.lg,
                    right: QzSpacing.lg,
                    bottom: QzSpacing.lg,
                    child: _SolidCancelButton(
                      key: const Key('backtest-progress-cancel'),
                      label: l10n.backtestProgressCancel,
                      onPressed: () => context.pop(),
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

String _normalizeBacktestSymbol(String raw) {
  final String value = raw.trim().toUpperCase().replaceAll('/', '');
  return value.isEmpty ? 'BTCUSDT' : value;
}

String _normalizePriceSource(String raw) {
  final String value = raw.trim().toLowerCase();
  if (value == 'open' || value == 'mid') return value;
  return 'close';
}

DateTime _resolveEnd(Map<String, String> params) {
  final String? raw = params['backtestEnd'];
  final DateTime? parsed = raw == null ? null : DateTime.tryParse(raw.trim());
  return parsed ?? DateTime.now();
}

DateTime _resolveStart(Map<String, String> params, DateTime end) {
  final String preset = (params['backtestRangePreset'] ?? '30D').toUpperCase();
  if (preset == 'CUSTOM') {
    final DateTime? parsed = DateTime.tryParse(
      params['backtestStart']?.trim() ?? '',
    );
    if (parsed != null) return parsed;
  }
  final int days = switch (preset) {
    '7D' => 7,
    '90D' => 90,
    '1Y' => 365,
    _ => 30,
  };
  return end.subtract(Duration(days: days));
}

class _SolidCancelButton extends StatelessWidget {
  const _SolidCancelButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final c = context.qzScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          height: 50,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: c.bgElev,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(14),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: c.text.withValues(alpha: 0.04),
                offset: const Offset(0, 2),
                blurRadius: 8,
              ),
            ],
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}
