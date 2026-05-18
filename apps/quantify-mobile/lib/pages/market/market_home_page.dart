import 'package:flutter/material.dart';

import '../../widgets/qz_empty_state.dart';

class MarketHomePage extends StatelessWidget {
  const MarketHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('行情')),
      body: const QzEmptyState(title: '行情列表'),
    );
  }
}
