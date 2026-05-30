import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

import 'helpers/load_fonts.dart';

/// flutter_test auto-discovers this file and wraps every test under `test/`.
/// Loading real bundled fonts before tests run makes golden renders
/// font-deterministic across environments (see #1782).
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();
  await loadAppFonts();
  await testMain();
}
