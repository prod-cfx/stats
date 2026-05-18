import 'package:flutter/material.dart';

import '../../widgets/qz_empty_state.dart';

class LongShortPage extends StatelessWidget {
  const LongShortPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('多空比')),
      body: const QzEmptyState(title: '多空比'),
    );
  }
}
