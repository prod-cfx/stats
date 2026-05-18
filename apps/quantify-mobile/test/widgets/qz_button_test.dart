import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_button.dart';

import '../helpers/golden_harness.dart';

void main() {
  testWidgets('QzButton golden baseline (light+violet)', (tester) async {
    await pumpQz(
      tester,
      const SizedBox(
        key: ValueKey<String>('qz_button_golden'),
        width: 240,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            QzButton(label: 'Primary'),
            SizedBox(height: 8),
            QzButton(label: 'Ghost', variant: QzButtonVariant.ghost),
            SizedBox(height: 8),
            QzButton(label: 'Accent', variant: QzButtonVariant.accent),
          ],
        ),
      ),
      surfaceSize: const Size(360, 200),
    );
    await expectLater(
      find.byKey(const ValueKey<String>('qz_button_golden')),
      matchesGoldenFile('goldens/qz_button.png'),
    );
  });

  testWidgets('QzButton renders cleanly under 9 themes', (tester) async {
    await verifyAllThemes(
      tester,
      () => const QzButton(label: 'Tap'),
      (t) async {
        expect(find.text('Tap'), findsOneWidget);
      },
    );
  });

  testWidgets('QzButton expanded keeps full width while loading',
      (tester) async {
    await pumpQz(
      tester,
      const SizedBox(
        width: 280,
        child: QzButton(
          label: 'Submit',
          loading: true,
          expanded: true,
        ),
      ),
    );
    final RenderBox box =
        tester.renderObject(find.byType(QzButton)) as RenderBox;
    expect(box.size.width, 280);
  });

  testWidgets('QzButton loading hides label and disables onPressed',
      (tester) async {
    int taps = 0;
    await pumpQz(
      tester,
      QzButton(
        label: 'Submit',
        loading: true,
        onPressed: () => taps++,
      ),
    );
    expect(find.text('Submit'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.tap(find.byType(QzButton));
    await tester.pump();
    expect(taps, 0);
  });
}
