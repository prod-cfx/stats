part of 'qz_deploy_sheet.dart';
// ignore_for_file: unused_element

class _ExchangePicker extends ConsumerWidget {
  const _ExchangePicker({required this.onPick, required this.onGoConfigure});

  final void Function(_DeployTarget) onPick;
  final VoidCallback onGoConfigure;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<ExchangeApiKey>> keys = ref.watch(apiKeysProvider);
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return keys.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: QzSpacing.lg),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (Object e, _) => Text(
        '${l10n.commonLoadError}: $e',
        style: TextStyle(color: c.textDim, fontSize: 13),
      ),
      data: (List<ExchangeApiKey> list) {
        // 合并目录与用户密钥；目录里命中 ExchangeApiKey 的项标 authorized。
        final List<_DeployTarget> targets = _kExchangeCatalog
            .map<_DeployTarget>((_ExchangeCatalogEntry e) {
              final ExchangeApiKey? account = list
                  .cast<ExchangeApiKey?>()
                  .firstWhere(
                    (ExchangeApiKey? k) => k?.exchange.toLowerCase() == e.code,
                    orElse: () => null,
                  );
              return _DeployTarget(
                catalog: e,
                accounts: account == null
                    ? <ExchangeApiKey>[]
                    : <ExchangeApiKey>[account],
                apiKey: account,
              );
            })
            .toList(growable: false);
        // 兜底：所有都未授权 + 用户从未配过任何 key → 引导按钮。
        final bool anyConfigured = targets.any(
          (_DeployTarget t) => t.authorized,
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            _RiskBanner(scheme: c, text: l10n.deployRiskBannerOk),
            const SizedBox(height: QzSpacing.md),
            for (final _DeployTarget t in targets)
              Padding(
                padding: const EdgeInsets.only(bottom: QzSpacing.sm),
                child: _ExchangeRow(target: t, onTap: () => onPick(t)),
              ),
            const SizedBox(height: QzSpacing.sm),
            _SafetyFooter(scheme: c, text: l10n.deployFooterSafety),
            if (!anyConfigured) ...<Widget>[
              const SizedBox(height: QzSpacing.md),
              QzButton(
                key: const Key('deploy-go-configure'),
                label: l10n.deployGoConfigureButton,
                variant: QzButtonVariant.accent,
                onPressed: onGoConfigure,
              ),
            ],
          ],
        );
      },
    );
  }
}


class _ExchangeRow extends StatelessWidget {
  const _ExchangeRow({required this.target, required this.onTap});

  final _DeployTarget target;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool authorized = target.authorized;
    final String? tagText = switch (target.catalog.tag) {
      _ExchangeTag.recommended => l10n.deployExchangeTagRecommended,
      _ExchangeTag.onchain => l10n.deployExchangeTagOnchain,
      _ExchangeTag.none => null,
    };
    return InkWell(
      key: Key('deploy-exchange-${target.catalog.code}'),
      onTap: onTap,
      borderRadius: BorderRadius.circular(QzRadii.card),
      child: Container(
        padding: const EdgeInsets.all(QzSpacing.md),
        decoration: BoxDecoration(
          color: c.bgSoft,
          border: Border.all(color: c.border),
          borderRadius: BorderRadius.circular(QzRadii.card),
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Text(
                        target.catalog.name.toUpperCase(),
                        style: TextStyle(
                          color: c.text,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (tagText != null) ...<Widget>[
                        const SizedBox(width: QzSpacing.xs),
                        _MiniTag(text: tagText, scheme: c),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    authorized
                        ? target.apiKey!.label
                        : l10n.deployUnauthorizedIdentityWarning,
                    style: TextStyle(
                      color: authorized ? c.textDim : c.marketDown,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: QzSpacing.sm,
                vertical: 2,
              ),
              decoration: BoxDecoration(
                color: authorized
                    ? c.marketUp.withValues(alpha: 0.15)
                    : c.border.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(QzRadii.pill),
              ),
              child: Text(
                authorized
                    ? l10n.deployExchangeConfigured
                    : l10n.deployExchangeNotConfigured,
                style: TextStyle(
                  color: authorized ? c.marketUp : c.textDim,
                  fontSize: 11,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}


class _AuthorizePane extends StatelessWidget {
  const _AuthorizePane({required this.apiKey, required this.onConfirm});

  final ExchangeApiKey apiKey;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          '${apiKey.exchange.toUpperCase()} · ${apiKey.label}',
          style: TextStyle(color: c.text, fontSize: 14),
        ),
        const SizedBox(height: QzSpacing.md),
        Text(
          l10n.deployAuthorizePermissionTitle,
          style: TextStyle(color: c.textDim, fontSize: 12),
        ),
        const SizedBox(height: QzSpacing.sm),
        for (final String perm in <String>[
          l10n.deployAuthorizePermissionSpot,
          l10n.deployAuthorizePermissionFutures,
          l10n.deployAuthorizePermissionBalance,
        ])
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              children: <Widget>[
                Icon(Icons.check_circle_outline, size: 14, color: c.marketUp),
                const SizedBox(width: QzSpacing.xs),
                Text(perm, style: TextStyle(color: c.text, fontSize: 13)),
              ],
            ),
          ),
        const SizedBox(height: QzSpacing.lg),
        QzButton(
          key: const Key('deploy-confirm'),
          label: l10n.deployAuthorizeConfirmButton,
          variant: QzButtonVariant.accent,
          onPressed: onConfirm,
        ),
      ],
    );
  }
}

/// 未授权交易所的 3 步引导 + 提币警告 + 合规 checkbox。
class _UnauthorizedPane extends StatelessWidget {
  const _UnauthorizedPane({
    required this.target,
    required this.consent,
    required this.onConsentChanged,
    required this.onCancel,
    required this.onOpenApiForm,
  });

  final _DeployTarget target;
  final bool consent;
  final ValueChanged<bool> onConsentChanged;
  final VoidCallback onCancel;
  final VoidCallback onOpenApiForm;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        // identity 卡片
        Container(
          padding: const EdgeInsets.all(QzSpacing.md),
          decoration: BoxDecoration(
            color: c.bgSoft,
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          child: Row(
            children: <Widget>[
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: c.border.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  target.catalog.name.isEmpty
                      ? '?'
                      : target.catalog.name.substring(0, 1),
                  style: TextStyle(
                    color: c.text,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      target.catalog.name,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      l10n.deployUnauthorizedIdentityWarning,
                      style: TextStyle(color: c.marketDown, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: QzSpacing.md),
        Text(
          l10n.deployUnauthorizedTitle,
          style: TextStyle(
            color: c.textDim,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: QzSpacing.sm),
        _Step(
          n: 1,
          title: l10n.deployUnauthorizedStep1Title,
          sub: l10n.deployUnauthorizedStep1Sub,
        ),
        _Step(
          n: 2,
          title: l10n.deployUnauthorizedStep2Title,
          sub: l10n.deployUnauthorizedStep2Sub,
        ),
        _Step(
          n: 3,
          title: l10n.deployUnauthorizedStep3Title,
          sub: l10n.deployUnauthorizedStep3Sub,
        ),
        const SizedBox(height: QzSpacing.md),
        // 提币权限警告
        Container(
          key: const Key('deploy-withdraw-warning'),
          padding: const EdgeInsets.all(QzSpacing.sm),
          decoration: BoxDecoration(
            color: c.marketDown.withValues(alpha: 0.10),
            border: Border.all(color: c.marketDown.withValues(alpha: 0.25)),
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(Icons.warning_amber_outlined, size: 16, color: c.marketDown),
              const SizedBox(width: QzSpacing.xs),
              Expanded(
                child: Text(
                  l10n.deployUnauthorizedWithdrawWarning,
                  style: TextStyle(
                    color: c.marketDown,
                    fontSize: 12,
                    height: 1.55,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: QzSpacing.sm),
        // consent checkbox
        InkWell(
          key: const Key('deploy-consent'),
          onTap: () => onConsentChanged(!consent),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: QzSpacing.xs),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: 18,
                  height: 18,
                  margin: const EdgeInsets.only(top: 1),
                  decoration: BoxDecoration(
                    color: consent ? c.accent : Colors.transparent,
                    border: Border.all(
                      color: consent ? c.accent : c.border,
                      width: 1.5,
                    ),
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: consent
                      ? const Icon(Icons.check, size: 14, color: Colors.white)
                      : null,
                ),
                const SizedBox(width: QzSpacing.xs),
                Expanded(
                  child: Text(
                    l10n.deployUnauthorizedConsent,
                    style: TextStyle(
                      color: c.textDim,
                      fontSize: 12,
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: QzSpacing.md),
        Row(
          children: <Widget>[
            QzButton(
              key: const Key('deploy-unauth-cancel'),
              label: l10n.deployUnauthorizedCancelButton,
              variant: QzButtonVariant.ghost,
              onPressed: onCancel,
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: QzButton(
                key: const Key('deploy-open-api-form'),
                label: l10n.deployUnauthorizedOpenFormButton,
                variant: QzButtonVariant.accent,
                onPressed: consent ? onOpenApiForm : null,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

