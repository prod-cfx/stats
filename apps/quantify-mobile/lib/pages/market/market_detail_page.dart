import 'package:flutter/material.dart';

import '../../widgets/qz_empty_state.dart';

class MarketDetailPage extends StatelessWidget {
  const MarketDetailPage({super.key, required this.symbol});

  final String symbol;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('行情详情：$symbol')),
      body: QzEmptyState(title: '行情详情：$symbol'),
    );
  }
}
