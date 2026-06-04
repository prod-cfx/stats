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

