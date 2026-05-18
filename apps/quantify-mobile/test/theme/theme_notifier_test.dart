import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:quantify_mobile/theme/theme_persistence.dart';

class _ThrowingPersistence implements ThemePersistence {
  _ThrowingPersistence(this._prefs);
  // Field exists only to satisfy the interface contract; never accessed.
  // ignore: unused_field
  final SharedPreferences _prefs;

  @override
  QzBg? readBg() => null;

  @override
  QzAccent? readAccent() => null;

  @override
  Future<void> writeBg(QzBg bg) async {
    throw StateError('simulated prefs failure');
  }

  @override
  Future<void> writeAccent(QzAccent a) async {
    throw StateError('simulated prefs failure');
  }
}

ProviderContainer _container(SharedPreferences prefs) {
  return ProviderContainer(
    overrides: <Override>[
      sharedPreferencesProvider.overrideWithValue(prefs),
    ],
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  test('falls back to (light, violet) when prefs are empty', () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer container = _container(prefs);
    addTearDown(container.dispose);

    expect(container.read(themeProvider), QzTheme.fallback);
  });

  test('hydrates from prefs when keys present', () async {
    SharedPreferences.setMockInitialValues(<String, Object>{
      ThemePersistence.kBg: QzBg.dark.name,
      ThemePersistence.kAccent: QzAccent.amber.name,
    });
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer container = _container(prefs);
    addTearDown(container.dispose);

    final QzTheme t = container.read(themeProvider);
    expect(t.bg, QzBg.dark);
    expect(t.accent, QzAccent.amber);
  });

  test('setBg / setAccent updates state and persists', () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer container = _container(prefs);
    addTearDown(container.dispose);

    await container.read(themeProvider.notifier).setBg(QzBg.pink);
    await container.read(themeProvider.notifier).setAccent(QzAccent.cyan);

    expect(container.read(themeProvider).bg, QzBg.pink);
    expect(container.read(themeProvider).accent, QzAccent.cyan);

    // Round-trip: new container reading the same prefs should see the change.
    final SharedPreferences prefs2 = await SharedPreferences.getInstance();
    final ProviderContainer container2 = _container(prefs2);
    addTearDown(container2.dispose);
    expect(container2.read(themeProvider),
        const QzTheme(bg: QzBg.pink, accent: QzAccent.cyan));
  });

  test('rolls state back when prefs write fails (M1 fix)', () async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final _ThrowingPersistence throwing = _ThrowingPersistence(prefs);
    final ProviderContainer container = ProviderContainer(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
        themePersistenceProvider.overrideWithValue(throwing),
      ],
    );
    addTearDown(container.dispose);

    final QzTheme initial = container.read(themeProvider);
    expect(initial, QzTheme.fallback);

    await expectLater(
      container.read(themeProvider.notifier).setBg(QzBg.dark),
      throwsA(isA<StateError>()),
    );
    expect(container.read(themeProvider), initial,
        reason: 'state rolls back on write failure');

    await expectLater(
      container.read(themeProvider.notifier).setAccent(QzAccent.amber),
      throwsA(isA<StateError>()),
    );
    expect(container.read(themeProvider), initial);
  });

  test('corrupted prefs entries are ignored (fallback applies)', () async {
    SharedPreferences.setMockInitialValues(<String, Object>{
      ThemePersistence.kBg: 'not-a-bg',
      ThemePersistence.kAccent: 'not-an-accent',
    });
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final ProviderContainer container = _container(prefs);
    addTearDown(container.dispose);

    expect(container.read(themeProvider), QzTheme.fallback);
  });
}
