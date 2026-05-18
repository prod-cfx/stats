import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'router/app_router.dart';
import 'theme/theme_data.dart';
import 'theme/theme_notifier.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.portraitUp,
  ]);
  // Resolve SharedPreferences eagerly so notifier `build()` stays synchronous
  // and we never observe a "before persistence loaded" state.
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      overrides: <Override>[
        sharedPreferencesProvider.overrideWithValue(prefs),
      ],
      child: const QuantifyMobileApp(),
    ),
  );
}

class QuantifyMobileApp extends ConsumerWidget {
  const QuantifyMobileApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzTheme theme = ref.watch(themeProvider);
    return MaterialApp.router(
      title: 'Quantify',
      theme: buildQzThemeData(theme),
      routerConfig: buildRouter(),
    );
  }
}
