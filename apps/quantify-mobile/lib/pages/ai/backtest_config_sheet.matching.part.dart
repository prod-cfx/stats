part of 'backtest_config_sheet.dart';
// ignore_for_file: unused_element

/// 高杠杆告警 banner（warn 色，20x/50x 时显示）。
class _WarnBanner extends StatelessWidget {
  const _WarnBanner({super.key, required this.scheme, required this.text});
  final QzColorScheme scheme;
  final String text;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: scheme.statusWarn.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.warning_amber_rounded, size: 14, color: scheme.statusWarn),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                color: scheme.statusWarn,
                fontSize: 11,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MatchingCard extends StatelessWidget {
  const _MatchingCard({
    required this.scheme,
    required this.slippage,
    required this.fee,
    required this.fillSource,
    required this.partialData,
    required this.l10n,
    required this.inputFormatters,
    required this.onInputChanged,
    required this.onFillSourceChanged,
    required this.onPartialDataChanged,
  });
  final QzColorScheme scheme;
  final TextEditingController slippage;
  final TextEditingController fee;
  final String fillSource;
  final bool partialData;
  final AppLocalizations l10n;
  final List<TextInputFormatter> inputFormatters;
  final ValueChanged<String> onInputChanged;
  final ValueChanged<String> onFillSourceChanged;
  final ValueChanged<String> onPartialDataChanged;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      scheme: scheme,
      padding: EdgeInsets.zero,
      child: Column(
        children: <Widget>[
          _MatchingRow(
            scheme: scheme,
            label: l10n.backtestFieldSlippage,
            hint: l10n.backtestHintSlippage,
            right: _BpsInput(
              key: const Key('backtest-slippage'),
              controller: slippage,
              scheme: scheme,
              inputFormatters: inputFormatters,
              onChanged: onInputChanged,
            ),
          ),
          _MatchingRow(
            scheme: scheme,
            label: l10n.backtestFieldFee,
            hint: l10n.backtestHintFee,
            right: _BpsInput(
              key: const Key('backtest-fee'),
              controller: fee,
              scheme: scheme,
              inputFormatters: inputFormatters,
              onChanged: onInputChanged,
            ),
          ),
          _MatchingRow(
            scheme: scheme,
            label: l10n.backtestFieldFillSource,
            hint: l10n.backtestHintFillSource,
            right: _Segmented(
              key: const Key('backtest-fill-source'),
              scheme: scheme,
              value: fillSource,
              expanded: false,
              options: <({String key, String label})>[
                (key: 'open', label: l10n.backtestFillOpen),
                (key: 'close', label: l10n.backtestFillClose),
                (key: 'mid', label: l10n.backtestFillMid),
              ],
              onChanged: onFillSourceChanged,
            ),
          ),
          _MatchingRow(
            scheme: scheme,
            label: l10n.backtestFieldPartialData,
            hint: l10n.backtestHintPartialData,
            last: true,
            right: _Segmented(
              key: const Key('backtest-partial-data'),
              scheme: scheme,
              value: partialData ? 'yes' : 'no',
              expanded: false,
              options: <({String key, String label})>[
                (key: 'yes', label: l10n.backtestPartialAllow),
                (key: 'no', label: l10n.backtestPartialDisallow),
              ],
              onChanged: onPartialDataChanged,
            ),
          ),
        ],
      ),
    );
  }
}

class _MatchingRow extends StatelessWidget {
  const _MatchingRow({
    required this.scheme,
    required this.label,
    required this.hint,
    required this.right,
    this.last = false,
  });
  final QzColorScheme scheme;
  final String label;
  final String hint;
  final Widget right;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: last ? Colors.transparent : scheme.borderSoft,
          ),
        ),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  label,
                  style: TextStyle(
                    color: scheme.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  hint,
                  style: TextStyle(color: scheme.textDim, fontSize: 11),
                ),
              ],
            ),
          ),
          const SizedBox(width: QzSpacing.md),
          right,
        ],
      ),
    );
  }
}

class _BpsInput extends StatelessWidget {
  const _BpsInput({
    super.key,
    required this.controller,
    required this.scheme,
    required this.inputFormatters,
    required this.onChanged,
  });
  final TextEditingController controller;
  final QzColorScheme scheme;
  final List<TextInputFormatter> inputFormatters;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 118,
      height: 34,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: scheme.bgInput,
        border: Border.all(color: scheme.borderSoft),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: TextField(
              controller: controller,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              inputFormatters: inputFormatters,
              onChanged: onChanged,
              textAlign: TextAlign.right,
              style: TextStyle(
                color: scheme.text,
                fontSize: 14,
                fontWeight: FontWeight.w600,
                fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
              ),
              decoration: const InputDecoration(
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.xs),
          Text(
            'bps',
            style: TextStyle(
              color: scheme.textDim,
              fontSize: 11,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

/// 区块标题 + 右侧补充说明（撮合参数 · 影响成交模拟）。
class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.scheme, required this.title, this.right});
  final QzColorScheme scheme;
  final String title;
  final String? right;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text(
            title,
            style: TextStyle(
              color: scheme.textMid,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (right != null)
            Text(right!, style: TextStyle(color: scheme.textDim, fontSize: 11)),
        ],
      ),
    );
  }
}

/// 「本次回测设定」summary 卡：5 行 key/value 双列回显。
class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.scheme,
    required this.title,
    required this.rows,
  });
  final QzColorScheme scheme;
  final String title;
  final List<({String k, String v})> rows;
  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('backtest-summary'),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: scheme.bgElev,
        border: Border.all(color: scheme.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            title,
            style: TextStyle(
              color: scheme.textDim,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: QzSpacing.sm),
          GridView.count(
            crossAxisCount: 2,
            childAspectRatio: 5.8,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            padding: EdgeInsets.zero,
            physics: const NeverScrollableScrollPhysics(),
            shrinkWrap: true,
            children: <Widget>[
              for (final r in rows)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: <Widget>[
                    Text(
                      r.k,
                      style: TextStyle(color: scheme.textDim, fontSize: 11),
                    ),
                    const SizedBox(width: QzSpacing.sm),
                    Expanded(
                      child: Text(
                        r.v,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: scheme.text,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          fontFeatures: const <FontFeature>[
                            FontFeature.tabularFigures(),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    super.key,
    required this.scheme,
    required this.label,
    required this.onPressed,
    this.accent = false,
  });
  final QzColorScheme scheme;
  final String label;
  final VoidCallback onPressed;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final Color fg = accent ? scheme.accentOn : scheme.text;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          height: 50,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: accent ? null : scheme.bgElev,
            gradient: accent ? scheme.accentGrad : null,
            border: accent ? null : Border.all(color: scheme.border),
            borderRadius: BorderRadius.circular(14),
            boxShadow: accent ? <BoxShadow>[scheme.accentShadow] : null,
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: fg,
              fontSize: 14,
              fontWeight: accent ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}
