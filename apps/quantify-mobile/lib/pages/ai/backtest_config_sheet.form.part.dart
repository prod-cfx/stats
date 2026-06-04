part of 'backtest_config_sheet.dart';
// ignore_for_file: unused_element

class _RecapStrip extends StatelessWidget {
  const _RecapStrip({required this.scheme});
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: scheme.accentSoft,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.auto_awesome, size: 14, color: scheme.accent),
          const SizedBox(width: 10),
          Expanded(
            child: Text.rich(
              TextSpan(
                text: '正在为「',
                children: <InlineSpan>[
                  const TextSpan(
                    text: 'BTC 趋势 · 双均线',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const TextSpan(text: '」配置回测参数'),
                ],
              ),
              style: TextStyle(color: scheme.accent, fontSize: 12, height: 1.5),
            ),
          ),
        ],
      ),
    );
  }
}

class _RangeChips extends StatelessWidget {
  const _RangeChips({
    required this.ranges,
    required this.value,
    required this.l10n,
    required this.scheme,
    required this.onChanged,
  });
  final List<({String key, int days})> ranges;
  final String value;
  final AppLocalizations l10n;
  final QzColorScheme scheme;
  final ValueChanged<String> onChanged;

  String _label(String key) => key == 'custom' ? l10n.backtestRangeCustom : key;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: QzSpacing.xs,
      runSpacing: QzSpacing.xs,
      children: <Widget>[
        for (final r in ranges)
          GestureDetector(
            key: Key('backtest-range-${r.key}'),
            onTap: () => onChanged(r.key),
            behavior: HitTestBehavior.opaque,
            child: Container(
              height: 34,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: r.key == value ? scheme.accentSoft : scheme.bgElev,
                border: Border.all(
                  color: r.key == value
                      ? scheme.accent.withValues(alpha: 0.3)
                      : scheme.border,
                ),
                borderRadius: BorderRadius.circular(QzRadii.pill),
              ),
              child: Align(
                widthFactor: 1,
                alignment: Alignment.center,
                child: Text(
                  _label(r.key),
                  style: TextStyle(
                    color: r.key == value ? scheme.accent : scheme.textMid,
                    fontSize: 13,
                    fontWeight: r.key == value
                        ? FontWeight.w600
                        : FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    super.key,
    required this.label,
    required this.controller,
    required this.scheme,
    required this.onChanged,
  });
  final String label;
  final TextEditingController controller;
  final QzColorScheme scheme;
  final ValueChanged<String> onChanged;

  Future<void> _pickDate(BuildContext context) async {
    final DateTime now = DateTime.now();
    final DateTime initial = DateTime.tryParse(controller.text.trim()) ?? now;
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(now.year + 1, 12, 31),
    );
    if (picked == null) return;
    controller.text =
        '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    onChanged(controller.text);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: TextStyle(color: scheme.textDim, fontSize: 10)),
        const SizedBox(height: 5),
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => _pickDate(context),
          child: Container(
            height: 42,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: scheme.bgInput,
              border: Border.all(color: scheme.borderSoft),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: IgnorePointer(
                    child: TextField(
                      controller: controller,
                      readOnly: true,
                      style: TextStyle(
                        color: scheme.text,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        fontFeatures: const <FontFeature>[
                          FontFeature.tabularFigures(),
                        ],
                      ),
                      decoration: const InputDecoration(
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        fillColor: Colors.transparent,
                        filled: false,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ),
                Icon(
                  Icons.calendar_today_outlined,
                  size: 14,
                  color: scheme.textDim,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CapitalCard extends StatelessWidget {
  const _CapitalCard({
    required this.controller,
    required this.presets,
    required this.scheme,
    required this.inputFormatters,
    required this.onChanged,
    required this.onPick,
  });
  final TextEditingController controller;
  final List<({String label, int value})> presets;
  final QzColorScheme scheme;
  final List<TextInputFormatter> inputFormatters;
  final ValueChanged<String> onChanged;
  final ValueChanged<int> onPick;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      scheme: scheme,
      marginBottom: 0,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            key: const Key('backtest-capital'),
            padding: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: scheme.borderSoft)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: <Widget>[
                Text(
                  r'$',
                  style: TextStyle(
                    color: scheme.textDim,
                    fontSize: 14,
                    fontFeatures: const <FontFeature>[
                      FontFeature.tabularFigures(),
                    ],
                  ),
                ),
                const SizedBox(width: QzSpacing.xs),
                Expanded(
                  child: TextField(
                    controller: controller,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    inputFormatters: inputFormatters,
                    onChanged: onChanged,
                    style: TextStyle(
                      color: scheme.text,
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      fontFeatures: const <FontFeature>[
                        FontFeature.tabularFigures(),
                      ],
                    ),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
                Text(
                  'USDT',
                  style: TextStyle(
                    color: scheme.textDim,
                    fontSize: 13,
                    fontFeatures: const <FontFeature>[
                      FontFeature.tabularFigures(),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: <Widget>[
              for (int i = 0; i < presets.length; i++) ...<Widget>[
                if (i > 0) const SizedBox(width: QzSpacing.xs),
                Expanded(
                  child: GestureDetector(
                    key: Key('backtest-capital-${presets[i].label}'),
                    onTap: () => onPick(presets[i].value),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      height: 28,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: scheme.bgSoft,
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: Text(
                        presets[i].label,
                        style: TextStyle(
                          color: scheme.textMid,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          fontFeatures: const <FontFeature>[
                            FontFeature.tabularFigures(),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          Text(
            '模拟资金,仅用于本次回测,不影响实盘',
            style: TextStyle(color: scheme.textDim, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.scheme,
    required this.child,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    this.marginBottom = 0,
  });
  final QzColorScheme scheme;
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double marginBottom;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: EdgeInsets.only(bottom: marginBottom),
      padding: padding,
      decoration: BoxDecoration(
        color: scheme.bgElev,
        border: Border.all(color: scheme.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: child,
    );
  }
}

/// 通用 segmented 选择器（现货/合约、成交价来源、数据缺失策略共用）。
class _Segmented extends StatelessWidget {
  const _Segmented({
    super.key,
    required this.scheme,
    required this.value,
    required this.options,
    required this.onChanged,
    this.expanded = true,
  });
  final QzColorScheme scheme;
  final String value;
  final List<({String key, String label})> options;
  final ValueChanged<String> onChanged;
  final bool expanded;

  Widget _item(({String key, String label}) o) {
    return GestureDetector(
      key: Key('backtest-seg-${o.key}'),
      behavior: HitTestBehavior.opaque,
      onTap: () => onChanged(o.key),
      child: Container(
        height: expanded ? 34 : 28,
        padding: expanded
            ? EdgeInsets.zero
            : const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
        alignment: expanded ? Alignment.center : null,
        decoration: BoxDecoration(
          color: o.key == value ? scheme.bgElev : Colors.transparent,
          borderRadius: BorderRadius.circular(expanded ? 8 : 6),
          border: o.key == value ? Border.all(color: scheme.border) : null,
        ),
        child: Align(
          widthFactor: expanded ? null : 1,
          alignment: Alignment.center,
          child: Text(
            o.label,
            style: TextStyle(
              fontSize: expanded ? 13 : 11.5,
              fontWeight: o.key == value ? FontWeight.w600 : FontWeight.w500,
              color: o.key == value ? scheme.accent : scheme.textMid,
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: scheme.bgInput,
        border: Border.all(color: scheme.borderSoft),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
        children: <Widget>[
          for (final o in options)
            expanded ? Expanded(child: _item(o)) : _item(o),
        ],
      ),
    );
  }
}

/// 杠杆选择：标题 + hint + 当前倍数大字 + 数字输入。
class _LeveragePicker extends StatelessWidget {
  const _LeveragePicker({
    required this.controller,
    required this.scheme,
    required this.label,
    required this.hint,
    required this.inputFormatters,
    required this.onChanged,
  });
  final TextEditingController controller;
  final QzColorScheme scheme;
  final String label;
  final String hint;
  final List<TextInputFormatter> inputFormatters;
  final ValueChanged<String> onChanged;

  String get _valueLabel =>
      '${controller.text.trim().isEmpty ? '5' : controller.text.trim()}x';

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
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
            Text(
              _valueLabel,
              style: TextStyle(
                color: scheme.accent,
                fontSize: 20,
                fontWeight: FontWeight.w700,
                fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: <Widget>[
            Expanded(
              child: Container(
                key: const Key('backtest-leverage-input'),
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: scheme.bgSoft,
                  border: Border.all(color: scheme.borderSoft),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: TextField(
                        controller: controller,
                        keyboardType: TextInputType.number,
                        inputFormatters: inputFormatters,
                        onChanged: onChanged,
                        style: TextStyle(
                          color: scheme.text,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          fontFeatures: const <FontFeature>[
                            FontFeature.tabularFigures(),
                          ],
                        ),
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          fillColor: Colors.transparent,
                          filled: false,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                    Text(
                      'x',
                      style: TextStyle(
                        color: scheme.textDim,
                        fontSize: 13,
                        fontFeatures: const <FontFeature>[
                          FontFeature.tabularFigures(),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: QzSpacing.sm),
            Text(
              '最大 100 倍',
              style: TextStyle(color: scheme.textDim, fontSize: 11),
            ),
          ],
        ),
      ],
    );
  }
}
