part of 'qz_deploy_sheet.dart';
// ignore_for_file: unused_element

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
