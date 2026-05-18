import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quantify_mobile/pages/market/long_short_page.dart';
import 'package:quantify_mobile/pages/market/widgets/long_short_bar.dart';
import 'package:quantify_mobile/router/app_router.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

Future<void> _pumpPage(
  WidgetTester tester, {
  QzTheme theme = QzTheme.fallback,
}) async {
  await tester.binding.setSurfaceSize(const Size(420, 1200));
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        locale: const Locale('zh'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: buildQzThemeData(theme),
        home: const LongShortPage(),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));
}

void main() {
  testWidgets('/market/long-short 真实路由可达', (WidgetTester tester) async {
    await tester.binding.setSurfaceSize(const Size(420, 1200));
    final GoRouter router = buildRouter();
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp.router(
          locale: const Locale('zh'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          theme: buildQzThemeData(QzTheme.fallback),
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();
    router.go('/market/long-short');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));

    expect(find.byType(LongShortPage), findsOneWidget);
    expect(find.byType(LongShortBar), findsWidgets);
    expect(find.text('历史'), findsOneWidget);
  });

  testWidgets('LongShortPage 9 主题循环 pump 不抛异常', (WidgetTester tester) async {
    for (final QzBg bg in QzBg.values) {
      for (final QzAccent accent in QzAccent.values) {
        await _pumpPage(
          tester,
          theme: QzTheme(bg: bg, accent: accent),
        );
        expect(find.byType(LongShortBar), findsWidgets);
        expect(tester.takeException(), isNull);
      }
    }
  });
}
