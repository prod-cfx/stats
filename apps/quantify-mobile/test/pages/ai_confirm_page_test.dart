import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/ai/ai_confirm_page.dart';
import 'package:quantify_mobile/theme/colors.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

Future<void> _pump(WidgetTester tester) async {
  await tester.binding.setSurfaceSize(const Size(420, 1600));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('zh'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: buildQzThemeData(
        const QzTheme(bg: QzBg.light, accent: QzAccent.violet),
      ),
      home: const AiConfirmPage(),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('确认策略 fallback market chip 默认合约 5x（#2066）', (
    WidgetTester tester,
  ) async {
    await _pump(tester);
    expect(find.text('合约 · 5x'), findsOneWidget);
    expect(find.text('合约 · 1x'), findsNothing);
  });
}
