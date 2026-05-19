import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:quantify_mobile/main.dart';
import 'package:quantify_mobile/pages/auth/login_page.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

void main() {
  testWidgets('boots the app on the login page by default',
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

    // Unauthenticated users land on /login by default — the dev preview
    // screens stay reachable via explicit `/_dev/*` paths only.
    expect(find.byType(LoginPage), findsOneWidget);
  });
}
