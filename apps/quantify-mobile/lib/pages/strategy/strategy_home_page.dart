import 'package:flutter/material.dart';

import '../../widgets/qz_empty_state.dart';

class StrategyHomePage extends StatelessWidget {
  const StrategyHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('策略')),
      body: const QzEmptyState(title: '策略广场'),
    );
  }
}
