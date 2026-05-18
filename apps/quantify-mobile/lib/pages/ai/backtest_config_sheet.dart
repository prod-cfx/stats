import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/backtest_models.dart';
import '../../data/providers.dart';
import '../../data/repositories/backtest_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_button.dart';
import '../../widgets/qz_segmented_tabs.dart';

/// Backtest configuration sheet — route `/ai/backtest-config`.
///
/// Implemented as a top-level full-screen route with a 64dp top inset +
/// 16dp top-radius so it visually reads like a bottom modal sheet without
/// changing the GoRoute signature (route shape is governed by #1507 auth
/// guard tests). A follow-up issue can migrate this to a real
/// `showModalBottomSheet` once the router refactor is in scope.
///
/// Form fields are intentionally minimal per #1508 acceptance:
///   - symbol (BTCUSDT / ETHUSDT / SOLUSDT)
///   - period (1h / 4h / 1d)
///   - time range (start / end — `YYYY-MM-DD` text inputs, validated by
///     `DateTime.tryParse`)
///   - leverage (slider 1× – 10×)
///   - initial capital (numeric text, USD)
///
/// Submitting calls `BacktestRepository.run`; on success the route pops with
/// the `BacktestResult` payload (or pops `null` on cancel) — the chat page
/// observes the return and inserts the resulting card into the conversation.
class BacktestConfigSheet extends ConsumerStatefulWidget {
  const BacktestConfigSheet({super.key});

  @override
  ConsumerState<BacktestConfigSheet> createState() =>
      _BacktestConfigSheetState();
}

class _BacktestConfigSheetState extends ConsumerState<BacktestConfigSheet> {
  static const List<String> _symbols = <String>[
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
  ];
  static const List<String> _periods = <String>['1h', '4h', '1d'];

  String _symbol = 'BTCUSDT';
  String _period = '1h';
  double _leverage = 1;
  final TextEditingController _start =
      TextEditingController(text: _isoDate(DateTime.now().subtract(const Duration(days: 30))));
  final TextEditingController _end =
      TextEditingController(text: _isoDate(DateTime.now()));
  final TextEditingController _capital =
      TextEditingController(text: '10000');

  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _start.dispose();
    _end.dispose();
    _capital.dispose();
    super.dispose();
  }

  static String _isoDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _submit() async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final DateTime? start = DateTime.tryParse(_start.text.trim());
    final DateTime? end = DateTime.tryParse(_end.text.trim());
    final double? capital = double.tryParse(_capital.text.trim());
    if (start == null || end == null) {
      setState(() => _error = l10n.backtestErrorInvalidDate);
      return;
    }
    if (!end.isAfter(start)) {
      setState(() => _error = l10n.backtestErrorEndBeforeStart);
      return;
    }
    if (capital == null || capital <= 0) {
      setState(() => _error = l10n.backtestErrorInvalidCapital);
      return;
    }

    setState(() {
      _error = null;
      _submitting = true;
    });

    final BacktestRepository repo = ref.read(backtestRepositoryProvider);
    final BacktestRequest req = BacktestRequest(
      strategyId: 'mock-strategy',
      symbol: _symbol,
      startTime: start,
      endTime: end,
      params: <String, dynamic>{
        'period': _period,
        'leverage': _leverage,
        'capital': capital,
      },
    );

    BacktestResult result;
    try {
      result = await repo.run(req);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = '${l10n.backtestErrorFailedPrefix}$e';
      });
      return;
    }
    if (!mounted) return;
    context.pop(result);
  }

  void _cancel() {
    if (_submitting) return;
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Scaffold(
      backgroundColor: c.scrim,
      body: SafeArea(
        top: false,
        child: Column(
          children: <Widget>[
            // Tap-to-dismiss top strip — matches modal-sheet UX.
            Expanded(
              child: GestureDetector(
                key: const Key('backtest-sheet-scrim'),
                behavior: HitTestBehavior.opaque,
                onTap: _cancel,
                child: const SizedBox.expand(),
              ),
            ),
            // Flexible (not Expanded) so the sheet honors its content's
            // natural height when there is room, but can shrink + scroll
            // when viewport is tight (e.g. widget-test default surface).
            Flexible(
              child: Container(
              decoration: BoxDecoration(
                color: c.bgElev,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(16),
                ),
              ),
              padding: EdgeInsets.fromLTRB(
                QzSpacing.lg,
                QzSpacing.md,
                QzSpacing.lg,
                QzSpacing.lg + MediaQuery.viewInsetsOf(context).bottom,
              ),
              // Wrap form body in a flexible scroll view so small viewports
              // (default 800×600 widget-test surface) don't trip
              // RenderFlex overflow on the inner Column.
              child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: c.borderStrong,
                        borderRadius:
                            BorderRadius.circular(QzRadii.pill),
                      ),
                    ),
                  ),
                  const SizedBox(height: QzSpacing.md),
                  Text(
                    l10n.backtestSheetTitle,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: QzSpacing.lg),
                  _FieldLabel(label: l10n.backtestFieldSymbol, scheme: c),
                  const SizedBox(height: QzSpacing.xs),
                  QzSegmentedTabs(
                    options: _symbols,
                    value: _symbol,
                    onChanged: (String v) => setState(() => _symbol = v),
                  ),
                  const SizedBox(height: QzSpacing.md),
                  _FieldLabel(label: l10n.backtestFieldPeriod, scheme: c),
                  const SizedBox(height: QzSpacing.xs),
                  QzSegmentedTabs(
                    options: _periods,
                    value: _period,
                    onChanged: (String v) => setState(() => _period = v),
                  ),
                  const SizedBox(height: QzSpacing.md),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            _FieldLabel(label: l10n.commonStart, scheme: c),
                            const SizedBox(height: QzSpacing.xs),
                            _TextInput(
                              key: const Key('backtest-start'),
                              controller: _start,
                              scheme: c,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: QzSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            _FieldLabel(label: l10n.commonEnd, scheme: c),
                            const SizedBox(height: QzSpacing.xs),
                            _TextInput(
                              key: const Key('backtest-end'),
                              controller: _end,
                              scheme: c,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: QzSpacing.md),
                  _FieldLabel(
                    label: '${l10n.backtestFieldLeverage} ${_leverage.toStringAsFixed(0)}×',
                    scheme: c,
                  ),
                  Slider(
                    key: const Key('backtest-leverage'),
                    value: _leverage,
                    min: 1,
                    max: 10,
                    divisions: 9,
                    onChanged: (double v) =>
                        setState(() => _leverage = v),
                  ),
                  _FieldLabel(label: l10n.backtestFieldCapital, scheme: c),
                  const SizedBox(height: QzSpacing.xs),
                  _TextInput(
                    key: const Key('backtest-capital'),
                    controller: _capital,
                    scheme: c,
                    keyboard: TextInputType.number,
                  ),
                  if (_error != null) ...<Widget>[
                    const SizedBox(height: QzSpacing.sm),
                    Text(
                      _error!,
                      style: TextStyle(
                        color: c.statusDanger,
                        fontSize: 12,
                      ),
                    ),
                  ],
                  const SizedBox(height: QzSpacing.lg),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: QzButton(
                          label: l10n.commonCancel,
                          variant: QzButtonVariant.ghost,
                          onPressed: _submitting ? null : _cancel,
                          expanded: true,
                        ),
                      ),
                      const SizedBox(width: QzSpacing.md),
                      Expanded(
                        child: QzButton(
                          key: const Key('backtest-submit'),
                          label: l10n.backtestStartButton,
                          variant: QzButtonVariant.accent,
                          onPressed: _submitting ? null : _submit,
                          loading: _submitting,
                          expanded: true,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              ),
            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel({required this.label, required this.scheme});
  final String label;
  final QzColorScheme scheme;
  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(color: scheme.textMid, fontSize: 12),
    );
  }
}

class _TextInput extends StatelessWidget {
  const _TextInput({
    super.key,
    required this.controller,
    required this.scheme,
    this.keyboard,
  });
  final TextEditingController controller;
  final QzColorScheme scheme;
  final TextInputType? keyboard;
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: scheme.bgInput,
        border: Border.all(color: scheme.border),
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.xs,
      ),
      child: TextField(
        controller: controller,
        keyboardType: keyboard,
        style: TextStyle(color: scheme.text, fontSize: 14),
        decoration: const InputDecoration(
          border: InputBorder.none,
          isDense: true,
        ),
      ),
    );
  }
}
