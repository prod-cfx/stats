import 'package:flutter/material.dart';

import '../../widgets/qz_empty_state.dart';

class LoginPage extends StatelessWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('登录')),
      body: const QzEmptyState(title: '登录占位'),
    );
  }
}
