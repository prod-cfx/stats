part of 'qz_deploy_sheet.dart';
// ignore_for_file: unused_element

class _PreflightPane extends StatefulWidget {
  const _PreflightPane({
    required this.target,
    required this.amount,
    required this.onAccountChanged,
    required this.onGoConfigure,
    required this.onBack,
    required this.onConfirm,
    this.stickyActions = false,
  });

  final _DeployTarget target;
  final double amount;
  final ValueChanged<String> onAccountChanged;
  final VoidCallback onGoConfigure;
  final VoidCallback onBack;
  final VoidCallback onConfirm;
  final bool stickyActions;

  @override
  State<_PreflightPane> createState() => _PreflightPaneState();
}

class _PreflightPaneState extends State<_PreflightPane> {
  static const Duration _scanInterval = Duration(milliseconds: 360);

  int _scanned = 0;
  bool _rechecking = false;
  // 首轮预检 mock 失败（去绑定 API / 余额不足 / 时延异常）；「重新检测」翻转为全 pass。
  // 替代旧的 3 项永远 pass，覆盖设计稿失败路径（#1896）。
  bool _recovered = false;
  Timer? _timer;

  List<PreflightCheck> _checks(AppLocalizations l10n) => <PreflightCheck>[
    PreflightCheck(
      ok: widget.target.authorized && _recovered,
      title: widget.target.authorized && _recovered
          ? l10n.deployPreflightApiOkTitle(widget.target.catalog.name)
          : l10n.deployPreflightApiFailTitle,
      sub: widget.target.authorized && _recovered
          ? l10n.deployPreflightApiOkSub
          : l10n.deployPreflightApiFailSub,
      actionable: !widget.target.authorized || !_recovered,
    ),
    PreflightCheck(
      ok: widget.target.authorized && _recovered,
      title: widget.target.authorized && _recovered
          ? l10n.deployPreflightBalanceOkTitle
          : l10n.deployPreflightBalanceFailTitle,
      sub: widget.target.authorized && _recovered
          ? l10n.deployPreflightBalanceOkSub
          : l10n.deployPreflightBalanceFailSub,
    ),
    PreflightCheck(
      ok: widget.target.authorized && _recovered,
      title: widget.target.authorized && _recovered
          ? l10n.deployPreflightLatencyOkTitle
          : l10n.deployPreflightLatencyFailTitle,
      sub: widget.target.authorized && _recovered
          ? l10n.deployPreflightLatencyOkSub
          : l10n.deployPreflightLatencyFailSub,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _startScan();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startScan() {
    _timer = Timer(_scanInterval, () {
      if (!mounted) return;
      setState(() => _scanned += 1);
      if (_scanned < 3) {
        _startScan();
      } else if (_rechecking) {
        setState(() => _rechecking = false);
      }
    });
  }

  void _recheck() {
    setState(() {
      _rechecking = true;
      _recovered = widget.target.authorized; // 复检：已绑定账户才 mock 全 pass。
      _scanned = 0;
    });
    _startScan();
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<PreflightCheck> checks = _checks(l10n);
    final bool scanning = _scanned < checks.length;
    final int pass = checks.where((PreflightCheck c) => c.ok).length;
    final int fail = checks.length - pass;
    final bool allPass = fail == 0;
    final bool canDeploy = !scanning && allPass;
    final List<Widget> content = <Widget>[
      // 只读账单确认：策略 + 风险 summary 卡（净值 / Sharpe / 最大回撤）
      // + 只读表单（交易所 / 市场类型 / 选择账户 / 部署杠杆）+ footnote（#1896）。
      Container(
        key: const Key('deploy-confirm-bill'),
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
        decoration: BoxDecoration(
          color: c.bgSoft,
          border: Border.all(color: c.border),
          borderRadius: BorderRadius.circular(QzRadii.card),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              l10n.deployPreflightStrategyName,
              style: TextStyle(
                color: c.text,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              l10n.deployPreflightStrategyMeta,
              style: TextStyle(color: c.textDim, fontSize: 11.5),
            ),
            const SizedBox(height: QzSpacing.lg),
            // 风险 summary 3 格（mock）。
            Row(
              children: <Widget>[
                _SummaryCell(
                  label: l10n.deployConfirmSummaryReturn,
                  value: '+38.2%',
                  valueColor: c.marketUp,
                  scheme: c,
                ),
                _SummaryCell(
                  label: l10n.deployConfirmSummarySharpe,
                  value: '1.86',
                  scheme: c,
                ),
                _SummaryCell(
                  label: l10n.deployConfirmSummaryMaxDrawdown,
                  value: '-12.4%',
                  valueColor: c.marketDown,
                  scheme: c,
                ),
              ],
            ),
            const SizedBox(height: QzSpacing.lg),
            Divider(color: c.border, height: 1),
            const SizedBox(height: QzSpacing.xs),
            // 只读表单。
            _DetailRow(
              label: l10n.deployConfirmFieldExchange,
              value: widget.target.catalog.name,
              scheme: c,
            ),
            _DetailRow(
              label: l10n.deployConfirmFieldMarketType,
              value: l10n.deployConfirmMarketPerp,
              scheme: c,
            ),
            _AccountSelectRow(
              accounts: widget.target.accounts,
              selected: widget.target.apiKey,
              scheme: c,
              label: l10n.deployConfirmFieldAccount,
              emptyText: widget.target.catalog.name,
              onChanged: widget.onAccountChanged,
            ),
            _DetailRow(
              label: l10n.deployConfirmFieldLeverage,
              value: '5x · 全仓',
              scheme: c,
            ),
            const SizedBox(height: 14),
            Text(
              l10n.deployConfirmFootnote,
              style: TextStyle(color: c.textDim, fontSize: 11.5, height: 1.6),
            ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      _PreflightChecksCard(
        scheme: c,
        title: l10n.deploySheetTitlePreflight,
        status: scanning
            ? l10n.deployPreflightScanning(_scanned, checks.length)
            : (allPass
                  ? l10n.deployPreflightPassed(pass, checks.length)
                  : l10n.deployPreflightFailed(fail, checks.length)),
        allPass: allPass,
        scanning: scanning,
        recheckLabel: _rechecking
            ? l10n.deployPreflightRechecking
            : l10n.deployPreflightRecheck,
        showRecheck: !allPass && !scanning,
        onRecheck: _rechecking ? null : _recheck,
        rows: <Widget>[
          for (int i = 0; i < checks.length; i++)
            _PreflightRow(
              index: i,
              check: checks[i],
              checking: i >= _scanned,
              scheme: c,
            ),
        ],
      ),
      if (!widget.target.authorized) ...<Widget>[
        const SizedBox(height: QzSpacing.sm),
        QzButton(
          key: const Key('deploy-go-configure'),
          label: l10n.deployGoConfigureButton,
          variant: QzButtonVariant.accent,
          onPressed: widget.onGoConfigure,
        ),
      ],
    ];
    final Widget actions = _PreflightActions(
      canDeploy: canDeploy,
      l10n: l10n,
      onBack: widget.onBack,
      onConfirm: widget.onConfirm,
    );

    if (widget.stickyActions) {
      return Stack(
        children: <Widget>[
          Positioned.fill(
            bottom: 92,
            child: SingleChildScrollView(
              padding: const EdgeInsets.only(top: QzSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: content,
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: <Color>[c.bg.withValues(alpha: 0), c.bg, c.bg],
                  stops: const <double>[0, 0.32, 1],
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(0, 12, 0, QzSpacing.xl),
                child: actions,
              ),
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        ...content,
        const SizedBox(height: QzSpacing.lg),
        actions,
      ],
    );
  }
}

class _PreflightActions extends StatelessWidget {
  const _PreflightActions({
    required this.canDeploy,
    required this.l10n,
    required this.onBack,
    required this.onConfirm,
  });

  final bool canDeploy;
  final AppLocalizations l10n;
  final VoidCallback onBack;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: QzButton(
            key: const Key('deploy-preflight-back'),
            label: l10n.deployPreflightBackButton,
            variant: QzButtonVariant.ghost,
            height: 50,
            onPressed: onBack,
          ),
        ),
        const SizedBox(width: QzSpacing.lg),
        Expanded(
          flex: 2,
          child: QzButton(
            key: const Key('deploy-preflight-confirm'),
            label: l10n.deployPreflightConfirmButton,
            variant: QzButtonVariant.accent,
            height: 50,
            onPressed: canDeploy ? onConfirm : null,
          ),
        ),
      ],
    );
  }
}

class _AccountSelectRow extends StatefulWidget {
  const _AccountSelectRow({
    required this.accounts,
    required this.selected,
    required this.scheme,
    required this.label,
    required this.emptyText,
    required this.onChanged,
  });

  final List<ExchangeApiKey> accounts;
  final ExchangeApiKey? selected;
  final QzColorScheme scheme;
  final String label;
  final String emptyText;
  final ValueChanged<String> onChanged;

  @override
  State<_AccountSelectRow> createState() => _AccountSelectRowState();
}

class _AccountSelectRowState extends State<_AccountSelectRow> {
  final LayerLink _link = LayerLink();
  OverlayEntry? _entry;

  bool get _open => _entry != null;

  @override
  void dispose() {
    _removeMenu();
    super.dispose();
  }

  void _toggleMenu() {
    if (_open) {
      _removeMenu();
    } else {
      _showMenu();
    }
  }

  void _removeMenu() {
    _entry?.remove();
    _entry = null;
  }

  void _showMenu() {
    final OverlayState overlay = Overlay.of(context);
    _entry = OverlayEntry(
      builder: (BuildContext context) => Stack(
        children: <Widget>[
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: _removeMenu,
            ),
          ),
          CompositedTransformFollower(
            link: _link,
            showWhenUnlinked: false,
            targetAnchor: Alignment.bottomRight,
            followerAnchor: Alignment.topRight,
            offset: const Offset(0, 6),
            child: _AccountMenu(
              accounts: widget.accounts,
              selected: widget.selected,
              scheme: widget.scheme,
              onPick: (String id) {
                widget.onChanged(id);
                _removeMenu();
              },
            ),
          ),
        ],
      ),
    );
    overlay.insert(_entry!);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = widget.scheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 11),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              widget.label,
              style: TextStyle(color: c.textDim, fontSize: 12),
            ),
          ),
          if (widget.accounts.isEmpty)
            Text(
              widget.emptyText,
              style: TextStyle(
                color: c.text,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            )
          else
            CompositedTransformTarget(
              link: _link,
              child: GestureDetector(
                key: const Key('deploy-account-select'),
                behavior: HitTestBehavior.opaque,
                onTap: _toggleMenu,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 144),
                      child: Text(
                        widget.selected?.label ?? widget.accounts.first.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: c.text,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(width: 5),
                    Icon(
                      _open
                          ? Icons.keyboard_arrow_up
                          : Icons.keyboard_arrow_down,
                      size: 16,
                      color: c.textDim,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _AccountMenu extends StatelessWidget {
  const _AccountMenu({
    required this.accounts,
    required this.selected,
    required this.scheme,
    required this.onPick,
  });

  final List<ExchangeApiKey> accounts;
  final ExchangeApiKey? selected;
  final QzColorScheme scheme;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        width: 236,
        padding: const EdgeInsets.all(QzSpacing.xs),
        decoration: BoxDecoration(
          color: scheme.bgElev,
          border: Border.all(color: scheme.border),
          borderRadius: BorderRadius.circular(12),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: scheme.text.withValues(alpha: 0.12),
              offset: const Offset(0, 16),
              blurRadius: 36,
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            for (final ExchangeApiKey account in accounts)
              _AccountMenuItem(
                account: account,
                selected: account.id == selected?.id,
                scheme: scheme,
                onTap: () => onPick(account.id),
              ),
          ],
        ),
      ),
    );
  }
}

class _AccountMenuItem extends StatelessWidget {
  const _AccountMenuItem({
    required this.account,
    required this.selected,
    required this.scheme,
    required this.onTap,
  });

  final ExchangeApiKey account;
  final bool selected;
  final QzColorScheme scheme;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 54,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: selected ? scheme.accentSoft : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: <Widget>[
            SizedBox(
              width: 18,
              child: selected
                  ? Icon(Icons.check, size: 17, color: scheme.accent)
                  : null,
            ),
            const SizedBox(width: QzSpacing.md),
            Expanded(
              child: Text(
                account.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: scheme.text,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PreflightChecksCard extends StatelessWidget {
  const _PreflightChecksCard({
    required this.scheme,
    required this.title,
    required this.status,
    required this.allPass,
    required this.scanning,
    required this.recheckLabel,
    required this.showRecheck,
    required this.onRecheck,
    required this.rows,
  });

  final QzColorScheme scheme;
  final String title;
  final String status;
  final bool allPass;
  final bool scanning;
  final String recheckLabel;
  final bool showRecheck;
  final VoidCallback? onRecheck;
  final List<Widget> rows;

  @override
  Widget build(BuildContext context) {
    final Color statusColor = allPass ? scheme.marketUp : scheme.marketDown;
    final Color statusBg = statusColor.withValues(alpha: 0.15);
    final Color headerBg = allPass
        ? scheme.bgInput
        : scheme.marketDown.withValues(alpha: 0.06);
    return Container(
      decoration: BoxDecoration(
        color: scheme.bgElev,
        border: Border.all(
          color: allPass
              ? scheme.borderSoft
              : scheme.marketDown.withValues(alpha: 0.3),
        ),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: <Widget>[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: headerBg,
              border: Border(bottom: BorderSide(color: scheme.borderSoft)),
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: allPass ? scheme.textDim : scheme.marketDown,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
                if (showRecheck) ...<Widget>[
                  _PreflightRecheckButton(
                    label: recheckLabel,
                    scheme: scheme,
                    onTap: onRecheck,
                  ),
                  const SizedBox(width: QzSpacing.sm),
                ],
                _PreflightStatusChip(
                  label: status,
                  color: scanning ? scheme.textDim : statusColor,
                  background: scanning ? scheme.bgInput : statusBg,
                  spinning: scanning,
                ),
              ],
            ),
          ),
          for (int i = 0; i < rows.length; i++) ...<Widget>[
            if (i > 0) Divider(height: 1, color: scheme.borderSoft),
            rows[i],
          ],
        ],
      ),
    );
  }
}

class _PreflightRecheckButton extends StatelessWidget {
  const _PreflightRecheckButton({
    required this.label,
    required this.scheme,
    required this.onTap,
  });

  final String label;
  final QzColorScheme scheme;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      key: const Key('deploy-preflight-recheck'),
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.7 : 1,
        child: Container(
          height: 24,
          padding: const EdgeInsets.symmetric(horizontal: 9),
          decoration: BoxDecoration(
            color: Colors.transparent,
            border: Border.all(color: scheme.marketDown),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(Icons.refresh_rounded, size: 12, color: scheme.marketDown),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  color: scheme.marketDown,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PreflightStatusChip extends StatelessWidget {
  const _PreflightStatusChip({
    required this.label,
    required this.color,
    required this.background,
    required this.spinning,
  });

  final String label;
  final Color color;
  final Color background;
  final bool spinning;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('deploy-preflight-status'),
      height: 22,
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (spinning) ...<Widget>[
            SizedBox(
              width: 11,
              height: 11,
              child: CircularProgressIndicator(strokeWidth: 2, color: color),
            ),
            const SizedBox(width: 4),
          ] else ...<Widget>[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

class _PreflightRow extends StatelessWidget {
  const _PreflightRow({
    required this.index,
    required this.check,
    required this.checking,
    required this.scheme,
  });

  final int index;
  final PreflightCheck check;
  final bool checking;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = scheme;
    final Color statusColor = check.ok ? c.marketUp : c.marketDown;
    return Container(
      key: Key('deploy-preflight-row-$index'),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      color: checking
          ? c.bgInput
          : (check.ok
                ? Colors.transparent
                : c.marketDown.withValues(alpha: 0.04)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 18,
            height: 18,
            child: checking
                ? CircularProgressIndicator(strokeWidth: 2, color: c.textDim)
                : Icon(
                    check.ok ? Icons.check_circle : Icons.cancel,
                    size: 18,
                    color: statusColor,
                  ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  check.title,
                  style: TextStyle(
                    color: checking
                        ? c.textDim
                        : (check.ok ? c.text : statusColor),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  check.sub,
                  style: TextStyle(color: c.textDim, fontSize: 11, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
