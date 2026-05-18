import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:quantify_mobile/main.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

void main() {
  testWidgets('boots the app with theme picker in debug mode',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final SharedPreferences prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          sharedPreferencesProvider.overrideWithValue(prefs),
        ],
        child: const QuantifyMobileApp(),
      ),
    );
    await tester.pump();

    // The dev preview is the debug-mode landing page.
    expect(find.text('Theme Preview (dev)'), findsOneWidget);
  });
}
