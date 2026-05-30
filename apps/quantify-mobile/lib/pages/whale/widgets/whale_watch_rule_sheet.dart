import 'package:flutter/material.dart';

import '../../../data/models/whale_watch_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_sheet.dart';

/// 监控规则新增/编辑表单 sheet（issue #1754 / #1769）。
///
/// 字段：地址（必填）、备注（可选）、阈值 USD（必填正数）、方向（单选）、
/// 通知渠道（网页 / 邮箱 / Telegram，多选，至少 1）。Telegram 在未绑定时
/// 为禁用态并提示先完成绑定（mock 阶段 [tgBound] 恒为 false）。编辑态预填
/// [initial]。校验失败行内错误提示；提交返回 [WatchRule]。取消返回 null。
class WhaleWatchRuleSheet {
  const WhaleWatchRuleSheet._();

  static Future<WatchRule?> show(
    BuildContext context, {
    WatchRule? initial,
    bool tgBound = false,
  }) {
    return QzSheet.show<WatchRule>(
      context: context,
      builder: (BuildContext ctx) =>
          _RuleForm(initial: initial, tgBound: tgBound),
    );
  }
}

class _RuleForm extends StatefulWidget {
  const _RuleForm({this.initial, this.tgBound = false});

  final WatchRule? initial;
  final bool tgBound;

  @override
  State<_RuleForm> createState() => _RuleFormState();
}

class _RuleFormState extends State<_RuleForm> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _addressCtrl;
  late final TextEditingController _aliasCtrl;
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
    _aliasCtrl = TextEditingController(text: r?.alias ?? '');
    _thresholdCtrl = TextEditingController(
      text: r == null ? '' : r.thresholdUsd.toStringAsFixed(0),
    );
    _direction = r?.direction ?? WatchRuleDirection.both;
    _channels = <WatchRuleChannel>{
      ...?r?.channels,
      if (r == null) WatchRuleChannel.push,
    };
    // Telegram 未绑定时，编辑态可能携带历史 telegram 渠道——保留显示但提交
    // 时由 _submit 过滤，避免在禁用态下静默生效一个用户无法管理的渠道。
  }

  @override
  void dispose() {
    _addressCtrl.dispose();
    _aliasCtrl.dispose();
    _thresholdCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    final bool formOk = _formKey.currentState?.validate() ?? false;
    // Telegram 未绑定：提交时剔除 telegram 渠道，确保结果与禁用 UI 一致。
    final Set<WatchRuleChannel> effective = <WatchRuleChannel>{
      for (final WatchRuleChannel ch in _channels)
        if (widget.tgBound || ch != WatchRuleChannel.telegram) ch,
    };
    final bool channelOk = effective.isNotEmpty;
    setState(() => _channelError = !channelOk);
    if (!formOk || !channelOk) return;

    final WatchRule? base = widget.initial;
    final double threshold = double.parse(_thresholdCtrl.text.trim());
    final String address = _addressCtrl.text.trim();
    final String aliasRaw = _aliasCtrl.text.trim();
    final String? alias = aliasRaw.isEmpty ? null : aliasRaw;
    final WatchRule result = base != null
        ? base.copyWith(
            alias: alias,
            thresholdUsd: threshold,
            direction: _direction,
            channels: effective,
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
            channels: effective,
            muted: false,
            alias: alias,
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
            _FieldLabel(text: l10n.whaleRuleAliasLabel),
            TextFormField(
              controller: _aliasCtrl,
              style: TextStyle(color: c.text, fontSize: 14),
              decoration: _inputDecoration(c, l10n.whaleRuleAliasHint),
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
            Container(
              decoration: BoxDecoration(
                border: Border.all(color: c.borderSoft),
                borderRadius: BorderRadius.circular(10),
                color: c.bgElev,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: Column(
                children: <Widget>[
                  for (int i = 0; i < WatchRuleChannel.values.length; i++)
                    _ChannelRow(
                      icon: _channelIcon(WatchRuleChannel.values[i]),
                      label: _channelLabel(WatchRuleChannel.values[i], l10n),
                      checked: _channels.contains(WatchRuleChannel.values[i]),
                      disabled:
                          WatchRuleChannel.values[i] == WatchRuleChannel.telegram
                              ? !widget.tgBound
                              : false,
                      showDivider: i != 0,
                      onChanged: (bool v) => setState(() {
                        final WatchRuleChannel ch = WatchRuleChannel.values[i];
                        v ? _channels.add(ch) : _channels.remove(ch);
                        _channelError = _channels.isEmpty;
                      }),
                    ),
                ],
              ),
            ),
            if (!widget.tgBound) ...<Widget>[
              const SizedBox(height: QzSpacing.xs),
              Text(
                l10n.whaleRuleChannelTelegramUnbound,
                style: TextStyle(color: c.textDim, fontSize: 11, height: 1.4),
              ),
            ],
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

  IconData _channelIcon(WatchRuleChannel ch) {
    switch (ch) {
      case WatchRuleChannel.push:
        return Icons.notifications_outlined;
      case WatchRuleChannel.telegram:
        return Icons.send_outlined;
      case WatchRuleChannel.email:
        return Icons.mail_outline;
    }
  }
}

/// 通知渠道行（issue #1769）。图标 + 标签 + 右侧 checkbox；[disabled] 时
/// 整行降透明度且不可点（用于 Telegram 未绑定态）。
class _ChannelRow extends StatelessWidget {
  const _ChannelRow({
    required this.icon,
    required this.label,
    required this.checked,
    required this.disabled,
    required this.showDivider,
    required this.onChanged,
  });

  final IconData icon;
  final String label;
  final bool checked;
  final bool disabled;
  final bool showDivider;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Opacity(
      opacity: disabled ? 0.6 : 1,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: disabled ? null : () => onChanged(!checked),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(
                color: showDivider ? c.borderSoft : Colors.transparent,
              ),
            ),
          ),
          child: Row(
            children: <Widget>[
              Icon(icon, size: 16, color: c.textMid),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: disabled ? c.textDim : c.text,
                    fontSize: 13,
                  ),
                ),
              ),
              _CheckBox(checked: checked && !disabled, disabled: disabled),
            ],
          ),
        ),
      ),
    );
  }
}

class _CheckBox extends StatelessWidget {
  const _CheckBox({required this.checked, required this.disabled});

  final bool checked;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool on = checked && !disabled;
    return Container(
      width: 18,
      height: 18,
      decoration: BoxDecoration(
        color: on ? c.accent : (disabled ? c.bgSoft : c.bgElev),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
          color: on ? c.accent : (disabled ? c.borderSoft : c.border),
          width: 1.5,
        ),
      ),
      child: on
          ? Icon(Icons.check, size: 12, color: c.accentOn)
          : const SizedBox.shrink(),
    );
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
