import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/auth/session_controller.dart';
import 'package:quantify_mobile/data/mock/mock_auth_repository.dart';
import 'package:quantify_mobile/data/mock/mock_strategy_repository.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/storage/secure_token_storage.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/auth/login_sheet.dart';
import 'package:quantify_mobile/pages/strategy/strategy_guest_page.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> _pumpGuest(WidgetTester tester) async {
  SharedPreferences.setMockInitialValues(<String, Object>{});
  final SharedPreferences prefs = await SharedPreferences.getInstance();
  final ProviderContainer container = ProviderContainer(
    overrides: <Override>[
      sharedPreferencesProvider.overrideWithValue(prefs),
      tokenStorageProvider.overrideWithValue(InMemoryTokenStorage()),
      authRepositoryProvider.overrideWithValue(MockAuthRepository()),
      strategyRepositoryProvider.overrideWithValue(MockStrategyRepository()),
    ],
  );
  await container.read(sessionControllerProvider.future);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(container.read(themeProvider)),
        home: const Scaffold(body: StrategyGuestPage()),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));
}

void main() {
  testWidgets(
    'guest landing renders hero, mini cards, hot list and unlock card',
    (WidgetTester tester) async {
      await _pumpGuest(tester);

      expect(find.byKey(const Key('strategy-guest-page')), findsOneWidget);
      expect(find.text('小白也能用的'), findsOneWidget);
      expect(find.text('AI 量化'), findsOneWidget);
      expect(find.text('交易工具'), findsOneWidget);
      expect(find.text('描述你的交易想法,AI 自动生成策略并帮你完成回测部署。'), findsOneWidget);
      expect(
        find.byKey(const Key('strategy-guest-cta-primary')),
        findsOneWidget,
      );
      expect(find.byKey(const Key('strategy-guest-mini-0')), findsOneWidget);
      expect(find.byKey(const Key('strategy-guest-mini-1')), findsOneWidget);
      expect(find.byKey(const Key('strategy-guest-mini-2')), findsOneWidget);
      expect(find.text('热门策略'), findsOneWidget);
      expect(find.text('HOT'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('登录解锁完整功能'), 260);
      expect(find.text('登录解锁完整功能'), findsOneWidget);
    },
  );

  testWidgets('guest landing CTA opens LoginSheet', (
    WidgetTester tester,
  ) async {
    await _pumpGuest(tester);

    await tester.tap(find.byKey(const Key('strategy-guest-cta-primary')));
    await tester.pumpAndSettle();

    expect(find.byType(LoginSheet), findsOneWidget);
  });

  testWidgets(
    'guest landing strategy card load conversation opens LoginSheet',
    (WidgetTester tester) async {
      await _pumpGuest(tester);

      await tester.tap(
        find.byKey(const Key('strategy-card-load-chat-st-grid-btc')),
      );
      await tester.pumpAndSettle();

      expect(find.byType(LoginSheet), findsOneWidget);
    },
  );
}
