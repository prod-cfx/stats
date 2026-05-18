import 'package:flutter/material.dart';

import '../../widgets/qz_empty_state.dart';

class ApiSettingsPage extends StatelessWidget {
  const ApiSettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('API 配置')),
      body: const QzEmptyState(title: 'API 配置'),
    );
  }
}
