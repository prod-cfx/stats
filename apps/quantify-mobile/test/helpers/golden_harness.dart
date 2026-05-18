import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

/// Pumps [child] inside a minimal [MaterialApp] wired to the qz design tokens.
///
/// Default surface (360×120) keeps single-component goldens narrow so the
/// stored PNGs read like component thumbnails instead of full screens.
Future<void> pumpQz(
  WidgetTester tester,
  Widget child, {
  QzBg bg = QzBg.light,
  QzAccent accent = QzAccent.violet,
  Size surfaceSize = const Size(360, 120),
}) async {
  await tester.binding.setSurfaceSize(surfaceSize);
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildQzThemeData(QzTheme(bg: bg, accent: accent)),
      home: Scaffold(body: Center(child: child)),
    ),
  );
  // Do NOT use pumpAndSettle: widgets like CircularProgressIndicator have
  // infinite animations that would time out. A single 16 ms frame (~60 fps)
  // is enough to resolve initial layout for tokens / themes without driving
  // any unbounded animation forward.
  await tester.pump(const Duration(milliseconds: 16));
}

/// Runs [verify] under all 9 (bg × accent) combinations and asserts that no
/// rendering exception (overflow / layout) is captured for any of them.
///
/// [build] is invoked fresh per iteration so widgets carrying internal state
/// (e.g. controllers) get a clean tree per theme.
Future<void> verifyAllThemes(
  WidgetTester tester,
  Widget Function() build,
  Future<void> Function(WidgetTester tester) verify, {
  Size surfaceSize = const Size(360, 120),
}) async {
  for (final QzBg bg in QzBg.values) {
    for (final QzAccent accent in QzAccent.values) {
      await pumpQz(
        tester,
        build(),
        bg: bg,
        accent: accent,
        surfaceSize: surfaceSize,
      );
      await verify(tester);
      expect(
        tester.takeException(),
        isNull,
        reason: 'rendering exception under bg=$bg accent=$accent',
      );
    }
  }
}
