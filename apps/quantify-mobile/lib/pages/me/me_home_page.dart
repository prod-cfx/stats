import 'package:flutter/material.dart';

import '../../widgets/qz_empty_state.dart';

class MeHomePage extends StatelessWidget {
  const MeHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('我的')),
      body: const QzEmptyState(title: '我的'),
    );
  }
}
