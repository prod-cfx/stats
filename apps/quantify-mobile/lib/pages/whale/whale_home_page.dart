import 'package:flutter/material.dart';

import '../../widgets/qz_empty_state.dart';

class WhaleHomePage extends StatelessWidget {
  const WhaleHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('巨鲸')),
      body: const QzEmptyState(title: '巨鲸动向'),
    );
  }
}
