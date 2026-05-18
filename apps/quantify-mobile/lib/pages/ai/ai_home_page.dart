import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../widgets/qz_empty_state.dart';

/// AI tab placeholder.
///
/// Hosts a tiny counter (`ai-counter-inc`) used by widget tests to verify
/// branch-state preservation across tab switches. The counter goes away once
/// the real AI chat page lands in a later PR.
class AiHomePage extends StatefulWidget {
  const AiHomePage({super.key});

  @override
  State<AiHomePage> createState() => _AiHomePageState();
}

class _AiHomePageState extends State<AiHomePage> {
  int _count = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI'),
        actions: <Widget>[
          // Debug-only state-preservation probe. Lives behind `kDebugMode` so
          // release builds never ship it — widget tests run in debug, which
          // keeps the `branch state is preserved across tab switch` test
          // working without leaking a test fixture into the user-facing UI.
          // Removed entirely once the real AI chat page lands.
          if (kDebugMode)
            TextButton(
              key: const Key('ai-counter-inc'),
              onPressed: () => setState(() => _count += 1),
              child: Text('count: $_count'),
            ),
        ],
      ),
      body: const QzEmptyState(title: 'AI 对话'),
    );
  }
}
