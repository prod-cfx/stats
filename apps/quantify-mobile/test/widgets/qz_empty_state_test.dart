import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_empty_state.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzEmptyState golden baseline — title only (light+violet)',
      (tester) async {
    await pumpQz(
      tester,
      const QzEmptyState(title: 'Nothing here'),
      surfaceSize: const Size(360, 160),
    );
    await expectLater(
      find.byType(QzEmptyState),
      matchesGoldenFile('goldens/qz_empty_state.png'),
    );
  });

  testWidgets('QzEmptyState golden baseline — with icon (light+violet)',
      (tester) async {
    await pumpQz(
      tester,
      const QzEmptyState(
        title: 'No strategies',
        icon: Icons.dashboard_outlined,
      ),
      surfaceSize: const Size(360, 200),
    );
    await expectLater(
      find.byType(QzEmptyState),
      matchesGoldenFile('goldens/qz_empty_state_with_icon.png'),
    );
  });

  testWidgets('QzEmptyState golden baseline — full (icon+subtitle+action)',
      (tester) async {
    await pumpQz(
      tester,
      QzEmptyState(
        title: 'No strategies yet',
        subtitle: 'Tap to create your first quant strategy.',
        icon: Icons.dashboard_outlined,
        action: TextButton(onPressed: () {}, child: const Text('Create')),
      ),
      surfaceSize: const Size(360, 320),
    );
    await expectLater(
      find.byType(QzEmptyState),
      matchesGoldenFile('goldens/qz_empty_state_full.png'),
    );
  });

  testWidgets('QzEmptyState renders cleanly under 9 themes', (tester) async {
    await verifyAllThemes(
      tester,
      () => const QzEmptyState(
        title: 'Empty',
        icon: Icons.inbox_outlined,
      ),
      (t) async {
        expect(find.text('Empty'), findsOneWidget);
      },
      surfaceSize: const Size(360, 160),
    );
  });

  testWidgets('QzEmptyState full variant renders cleanly under 9 themes',
      (tester) async {
    await verifyAllThemes(
      tester,
      () => QzEmptyState(
        title: 'No data',
        subtitle: 'Refresh to fetch the latest snapshot.',
        icon: Icons.refresh,
        action: TextButton(onPressed: () {}, child: const Text('Refresh')),
      ),
      (t) async {
        expect(find.text('No data'), findsOneWidget);
        expect(find.text('Refresh'), findsOneWidget);
      },
      surfaceSize: const Size(360, 320),
    );
  });
}
