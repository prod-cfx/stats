part of 'api_form_sheet.dart';
// ignore_for_file: unused_element

class _FieldHint extends StatelessWidget {
  const _FieldHint({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Text(
      text,
      style: TextStyle(color: c.textMid, fontSize: 11, height: 1.5),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label({required this.text, this.required = false});
  final String text;
  final bool required;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      children: <Widget>[
        Text(
          text,
          style: TextStyle(
            color: c.text,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
        if (required) ...<Widget>[
          const SizedBox(width: 4),
          Text('*', style: TextStyle(color: c.statusDanger, fontSize: 13)),
        ],
      ],
    );
  }
}

/// 「授权权限」区块（对齐设计稿 `m-screens-4.jsx:2998-3015`）。
///
/// - key 模式：读取账户与持仓 / 现货下单 / 合约下单（均 ok）+ 提币（blocked）。
/// - wallet 模式：读取账户与持仓 / 永续·现货下单（均 ok）+ 转账·提币（disabled）。
class _PermissionList extends StatelessWidget {
  const _PermissionList({
    required this.l10n,
    required this.wallet,
    this.testnet = false,
  });
  final AppLocalizations l10n;
  final bool wallet;
  final bool testnet;

  @override
  Widget build(BuildContext context) {
    if (wallet) {
      return Column(
        children: <Widget>[
          _PermissionRow(
            label: l10n.meApiFormPermAccountRead,
            value: l10n.meApiFormPermRequired,
            tone: _PermTone.ok,
          ),
          const SizedBox(height: 8),
          _PermissionRow(
            label: l10n.meApiFormPermPerpSpotOrder,
            value: l10n.meApiFormPermRequired,
            tone: _PermTone.ok,
          ),
          const SizedBox(height: 8),
          _PermissionRow(
            label: l10n.meApiFormPermTransferWithdraw,
            value: l10n.meApiFormPermAgentNoAccess,
            tone: _PermTone.disabled,
          ),
        ],
      );
    }
    return Column(
      children: <Widget>[
        _PermissionRow(
          label: l10n.meApiFormPermAccountRead,
          value: l10n.meApiFormPermRequired,
          tone: _PermTone.ok,
        ),
        const SizedBox(height: 8),
        _PermissionRow(
          label: l10n.meApiFormPermSpotOrder,
          value: l10n.meApiFormPermRequired,
          tone: _PermTone.ok,
        ),
        const SizedBox(height: 8),
        _PermissionRow(
          label: l10n.meApiFormPermFuturesOrder,
          value: l10n.meApiFormPermOptional,
          tone: _PermTone.ok,
        ),
        const SizedBox(height: 8),
        // 测试网无资金，提币行降级为 disabled「测试网无提币」（设计稿 3058）。
        _PermissionRow(
          label: l10n.meApiFormPermWithdrawLabel,
          value: testnet
              ? l10n.meApiFormPermWithdrawTestnetValue
              : l10n.meApiFormPermWithdrawValue,
          tone: testnet ? _PermTone.disabled : _PermTone.blocked,
        ),
      ],
    );
  }
}

enum _PermTone { ok, blocked, disabled }

class _PermissionRow extends StatelessWidget {
  const _PermissionRow({
    required this.label,
    required this.value,
    required this.tone,
  });
  final String label;
  final String value;
  final _PermTone tone;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color fg;
    final Color bg;
    final IconData icon;
    switch (tone) {
      case _PermTone.ok:
        fg = c.statusOk;
        bg = c.statusOk.withValues(alpha: 0.10);
        icon = Icons.check_circle_outline;
      case _PermTone.blocked:
        fg = c.statusDanger;
        bg = c.statusDanger.withValues(alpha: 0.10);
        icon = Icons.block;
      case _PermTone.disabled:
        fg = c.textMid;
        bg = c.bgInput;
        icon = Icons.remove;
    }
    final double opacity = tone == _PermTone.disabled ? 0.6 : 1;
    return Opacity(
      opacity: opacity,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(QzRadii.input),
        ),
        child: Row(
          children: <Widget>[
            Icon(icon, size: 16, color: fg),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: c.text,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            Text(
              value,
              style: TextStyle(
                color: fg,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WarningBanner extends StatelessWidget {
  const _WarningBanner({
    required this.exchange,
    required this.wallet,
    this.testnet = false,
  });
  final String exchange;
  final bool wallet;
  final bool testnet;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    // 测试网文案不绑定具体域名；接口域名后续由配置接口补齐。
    final String boldText = testnet
        ? l10n.meApiFormTestnetWarningBold
        : (wallet
              ? l10n.meApiFormWalletWarningMust
              : l10n.meApiFormWarningMust);
    final String bodyText = testnet
        ? l10n.meApiFormTestnetWarningBody
        : (wallet
              ? l10n.meApiFormWalletWarningBody
              : l10n.meApiFormWarningBody(exchange));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: c.statusWarn.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.shield_outlined, size: 16, color: c.statusWarn),
          const SizedBox(width: 10),
          Expanded(
            child: Text.rich(
              TextSpan(
                style: TextStyle(
                  color: c.statusWarn,
                  fontSize: 12,
                  height: 1.55,
                ),
                children: <InlineSpan>[
                  TextSpan(
                    text: boldText,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  TextSpan(text: bodyText),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 标题旁的 `TESTNET` 琥珀标签（设计稿 `m-screens-4.jsx:2864`）。
class _TestnetBadge extends StatelessWidget {
  const _TestnetBadge({required this.c});
  final QzColorScheme c;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 7),
      decoration: BoxDecoration(
        color: c.statusWarn.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(5),
      ),
      alignment: Alignment.center,
      child: Text(
        'TESTNET',
        style: TextStyle(
          color: c.statusWarn,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

/// 主网 / 测试网分段控件（设计稿 `m-screens-4.jsx:2879-2918`）。
class _EnvToggle extends StatelessWidget {
  const _EnvToggle({
    required this.l10n,
    required this.env,
    required this.onChanged,
  });
  final AppLocalizations l10n;
  final ApiEnv env;
  final ValueChanged<ApiEnv> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: c.bgInput,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(11),
      ),
      child: Row(
        children: <Widget>[
          _segment(
            c,
            selected: env == ApiEnv.mainnet,
            label: l10n.meApiFormEnvMainnetLabel,
            sub: l10n.meApiFormEnvMainnetSub,
            color: c.accent,
            onTap: () => onChanged(ApiEnv.mainnet),
          ),
          const SizedBox(width: 3),
          _segment(
            c,
            selected: env == ApiEnv.testnet,
            label: l10n.meApiFormEnvTestnetLabel,
            sub: l10n.meApiFormEnvTestnetSub,
            color: c.statusWarn,
            onTap: () => onChanged(ApiEnv.testnet),
          ),
        ],
      ),
    );
  }

  Widget _segment(
    QzColorScheme c, {
    required bool selected,
    required String label,
    required String sub,
    required Color color,
    required VoidCallback onTap,
  }) {
    final Color fg = selected ? color : c.textMid;
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected ? c.bgElev : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            children: <Widget>[
              Text(
                label,
                style: TextStyle(
                  color: fg,
                  fontSize: 13,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                sub,
                style: TextStyle(
                  color: selected ? fg : c.textMid,
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 主网 tab 内容遮罩：保留底层表单结构，后续主网开放时移除该 gate 即可。
class _MainnetGate extends StatelessWidget {
  const _MainnetGate({
    required this.enabled,
    required this.message,
    required this.child,
  });

  final bool enabled;
  final String message;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!enabled) return child;
    final QzColorScheme c = context.qzScheme;
    return Stack(
      children: <Widget>[
        IgnorePointer(child: Opacity(opacity: 0.42, child: child)),
        Positioned.fill(
          child: Container(
            alignment: Alignment.topCenter,
            padding: const EdgeInsets.fromLTRB(16, 32, 16, 0),
            decoration: BoxDecoration(
              color: c.bgElev.withValues(alpha: 0.72),
              borderRadius: BorderRadius.circular(QzRadii.card),
            ),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: c.statusWarn.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(QzRadii.input),
                border: Border.all(color: c.statusWarn.withValues(alpha: 0.28)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Icon(
                    Icons.lock_clock_outlined,
                    size: 16,
                    color: c.statusWarn,
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      message,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.statusWarn,
                        fontSize: 12,
                        height: 1.35,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// 测试网接口域名 mono hint（设计稿 `m-screens-4.jsx:2998-3015`）。
class _EndpointHint extends StatelessWidget {
  const _EndpointHint({required this.l10n});
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: c.bgInput,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.meApiFormEndpointLabel,
            style: TextStyle(
              color: c.textMid,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _testnetEndpoint.isEmpty
                ? l10n.meApiFormEndpointEmpty
                : _testnetEndpoint,
            style: TextStyle(
              color: _testnetEndpoint.isEmpty ? c.textMid : c.text,
              fontSize: 12,
              fontWeight: FontWeight.w500,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}

/// 测试网保存按钮：琥珀渐变（设计稿 `m-screens-4.jsx:3024-3038`）。
class _TestnetSaveButton extends StatelessWidget {
  const _TestnetSaveButton({
    required this.label,
    required this.loading,
    required this.onPressed,
  });
  final String label;
  final bool loading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final bool disabled = loading || onPressed == null;
    return Opacity(
      opacity: disabled ? 0.6 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: disabled ? null : onPressed,
          borderRadius: BorderRadius.circular(QzRadii.input),
          child: Container(
            height: 44,
            decoration: BoxDecoration(
              gradient: _testnetButtonGrad,
              borderRadius: BorderRadius.circular(QzRadii.input),
            ),
            alignment: Alignment.center,
            child: loading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
