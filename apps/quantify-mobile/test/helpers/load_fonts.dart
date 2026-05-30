import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Registers the real bundled fonts into the test font system so golden
/// renders use deterministic glyph metrics instead of the placeholder font.
///
/// Without this, `flutter test` falls back to a placeholder/host font and
/// golden baselines drift across machines. Loading the actual pubspec fonts
/// locks rendering to the bundled typefaces regardless of host.
bool _loaded = false;

Future<void> loadAppFonts() async {
  if (_loaded) return;
  _loaded = true;

  final fontManifest = <_FontSpec>[
    _FontSpec('Inter', <String>[
      'assets/fonts/Inter-Regular.ttf',
      'assets/fonts/Inter-Medium.ttf',
      'assets/fonts/Inter-SemiBold.ttf',
      'assets/fonts/Inter-Bold.ttf',
    ]),
    _FontSpec('JetBrainsMono', <String>[
      'assets/fonts/JetBrainsMono-Regular.ttf',
      'assets/fonts/JetBrainsMono-Medium.ttf',
      'assets/fonts/JetBrainsMono-Bold.ttf',
    ]),
  ];

  for (final spec in fontManifest) {
    final loader = FontLoader(spec.family);
    for (final path in spec.assetPaths) {
      final file = File(path);
      if (!file.existsSync()) continue;
      loader.addFont(
        Future<ByteData>.value(
          ByteData.view(file.readAsBytesSync().buffer),
        ),
      );
    }
    await loader.load();
  }
}

class _FontSpec {
  const _FontSpec(this.family, this.assetPaths);

  final String family;
  final List<String> assetPaths;
}
