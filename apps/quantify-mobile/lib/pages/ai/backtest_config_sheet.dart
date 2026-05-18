import 'package:flutter/material.dart';

import '../../widgets/qz_empty_state.dart';

/// Placeholder full-screen page for `/ai/backtest-config`.
///
/// Filename keeps the "sheet" suffix to flag intent: a later PR will swap this
/// route to a `showModalBottomSheet` via `GoRoute.pageBuilder` once the actual
/// backtest config form lands.
class BacktestConfigSheet extends StatelessWidget {
  const BacktestConfigSheet({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('回测配置')),
      body: const QzEmptyState(title: '回测配置'),
    );
  }
}
