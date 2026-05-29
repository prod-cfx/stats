import 'package:flutter/material.dart';

import '../../../data/models/whale_watch_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_sheet.dart';

/// 监控规则新增/编辑表单 sheet（issue #1754）。
///
/// 字段：地址（必填）、阈值 USD（必填正数）、方向（单选）、渠道（多选，
/// 至少 1）。编辑态预填 [initial]。校验失败行内错误提示；提交返回
/// [WatchRule]（编辑保留 id / 显示字段，新增生成临时 id）。取消返回 null。
class WhaleWatchRuleSheet {
  const WhaleWatchRuleSheet._();

  static Future<WatchRule?> show(
    BuildContext context, {
    WatchRule? initial,
  }) {
    return QzSheet.show<WatchRule>(
      context: context,
      builder: (BuildContext ctx) => _RuleForm(initial: initial),
    );
  }
}

class _RuleForm extends StatefulWidget {
  const _RuleForm({this.initial});

  final WatchRule? initial;

  @override
  State<_RuleForm> createState() => _RuleFormState();
}

class _RuleFormState extends State<_RuleForm> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _addressCtrl;
  late final TextEditingController _thresholdCtrl;
  late WatchRuleDirection _direction;
  late Set<WatchRuleChannel> _channels;
  bool _channelError = false;

  bool get _isEdit => widget.initial != null;

  @override
  void initState() {
    super.initState();
    final WatchRule? r = widget.initial;
    _addressCtrl = TextEditingController(text: r?.address ?? '');
    _thresholdCtrl = TextEditingController(
      text: r == null ? '' : r.thresholdUsd.toStringAsFixed(0),
    );
    _direction = r?.direction ?? WatchRuleDirection.both;
    _channels = <WatchRuleChannel>{
      ...?r?.channels,
      if (r == null) WatchRuleChannel.push,
    };
  }

  @override
  void dispose() {
    _addressCtrl.dispose();
    _thresholdCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final bool formOk = _formKey.currentState?.validate() ?? false;
    final bool channelOk = _channels.isNotEmpty;
    setState(() => _channelError = !channelOk);
    if (!formOk || !channelOk) return;

    final WatchRule? base = widget.initial;
    final double threshold = double.parse(_thresholdCtrl.text.trim());
    final String address = _addressCtrl.text.trim();
    // 拷贝一份渠道集合，避免 result 与表单可变态共享同一 Set 引用。
    final Set<WatchRuleChannel> channels = Set<WatchRuleChannel>.of(_channels);
    final WatchRule result = base != null
        ? base.copyWith(
            thresholdUsd: threshold,
            direction: _direction,
            channels: channels,
          )
        : WatchRule(
            id: 'w${DateTime.now().microsecondsSinceEpoch}',
            name: address,
            address: address,
            lastEventDisplay: '—',
            tone: 'up',
            pnlDisplay: '—',
            live: false,
            thresholdUsd: threshold,
            direction: _direction,
            channels: channels,
            muted: false,
          );
    Navigator.of(context).pop(result);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        0,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              _isEdit ? l10n.whaleRuleEditTitle : l10n.whaleRuleAddTitle,
              style: TextStyle(
                color: c.text,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: QzSpacing.lg),
            _FieldLabel(text: l10n.whaleRuleAddressLabel),
            TextFormField(
              controller: _addressCtrl,
              enabled: !_isEdit, // 编辑态地址不可改（规则锚定地址）
              style: TextStyle(color: c.text, fontSize: 14),
              decoration: _inputDecoration(c, l10n.whaleRuleAddressHint),
              validator: (String? v) {
                final String value = (v ?? '').trim();
                if (value.isEmpty) return l10n.whaleRuleAddressRequired;
                if (value.length < 4) return l10n.whaleRuleAddressInvalid;
                return null;
              },
            ),
            const SizedBox(height: QzSpacing.md),
            _FieldLabel(text: l10n.whaleRuleThresholdLabel),
            TextFormField(
              controller: _thresholdCtrl,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              style: TextStyle(color: c.text, fontSize: 14),
              decoration: _inputDecoration(c, l10n.whaleRuleThresholdHint),
              validator: (String? v) {
                final String value = (v ?? '').trim();
                if (value.isEmpty) return l10n.whaleRuleThresholdRequired;
                final double? n = double.tryParse(value);
                if (n == null || n <= 0) {
                  return l10n.whaleRuleThresholdInvalid;
                }
                return null;
              },
            ),
            const SizedBox(height: QzSpacing.md),
            _FieldLabel(text: l10n.whaleRuleDirectionLabel),
            const SizedBox(height: QzSpacing.xs),
            Wrap(
              spacing: QzSpacing.xs,
              children: <Widget>[
                for (final WatchRuleDirection d in WatchRuleDirection.values)
                  _ChoiceChip(
                    label: _directionLabel(d, l10n),
                    selected: _direction == d,
                    onTap: () => setState(() => _direction = d),
                  ),
              ],
            ),
            const SizedBox(height: QzSpacing.md),
            _FieldLabel(text: l10n.whaleRuleChannelLabel),
            const SizedBox(height: QzSpacing.xs),
            Wrap(
              spacing: QzSpacing.xs,
              children: <Widget>[
                for (final WatchRuleChannel ch in WatchRuleChannel.values)
                  _ChoiceChip(
                    label: _channelLabel(ch, l10n),
                    selected: _channels.contains(ch),
                    onTap: () => setState(() {
                      _channels.contains(ch)
                          ? _channels.remove(ch)
                          : _channels.add(ch);
                      _channelError = _channels.isEmpty;
                    }),
                  ),
              ],
            ),
            if (_channelError) ...<Widget>[
              const SizedBox(height: QzSpacing.xs),
              Text(
                l10n.whaleRuleChannelRequired,
                style: TextStyle(color: c.statusDanger, fontSize: 11),
              ),
            ],
            const SizedBox(height: QzSpacing.lg),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: FilledButton(
                onPressed: _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: c.accent,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  _isEdit ? l10n.whaleRuleSave : l10n.whaleRuleCreate,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(QzColorScheme c, String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: c.textDim, fontSize: 13),
      filled: true,
      fillColor: c.bgSoft,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: 12,
        vertical: 12,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
    );
  }

  String _directionLabel(WatchRuleDirection d, AppLocalizations l10n) {
    switch (d) {
      case WatchRuleDirection.inflow:
        return l10n.whaleRuleDirectionInflow;
      case WatchRuleDirection.outflow:
        return l10n.whaleRuleDirectionOutflow;
      case WatchRuleDirection.both:
        return l10n.whaleRuleDirectionBoth;
    }
  }

  String _channelLabel(WatchRuleChannel ch, AppLocalizations l10n) {
    switch (ch) {
      case WatchRuleChannel.push:
        return l10n.whaleRuleChannelPush;
      case WatchRuleChannel.telegram:
        return l10n.whaleRuleChannelTelegram;
      case WatchRuleChannel.email:
        return l10n.whaleRuleChannelEmail;
    }
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: QzSpacing.xs),
      child: Text(
        text,
        style: TextStyle(
          color: c.textMid,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _ChoiceChip extends StatelessWidget {
  const _ChoiceChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? c.accentSoft : c.bgSoft,
          borderRadius: BorderRadius.circular(QzRadii.pill),
          border: Border.all(
            color: selected ? c.accent : c.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? c.accent : c.textMid,
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}
