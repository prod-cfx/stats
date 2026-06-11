import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/l10n/app_localizations.dart';
import 'package:quantify_mobile/pages/whale/widgets/whale_card_controls.dart';
import 'package:quantify_mobile/theme/theme_data.dart';
import 'package:quantify_mobile/theme/theme_notifier.dart';

void main() {
  testWidgets(
    'WhaleAddressLink renders displayAddress and keeps tap callback',
    (WidgetTester tester) async {
      int taps = 0;

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('zh'),
          theme: buildQzThemeData(QzTheme.fallback),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: WhaleAddressLink(
              address: '0xabcdefabcdefabcdef01',
              displayAddress: '0xabcd...ef01',
              onOpen: () => taps++,
            ),
          ),
        ),
      );

      expect(find.text('0xabcd...ef01'), findsOneWidget);
      expect(find.text('0xabcdefabcdefabcdef01'), findsNothing);

      await tester.tap(find.text('0xabcd...ef01'));
      expect(taps, 1);
    },
  );
}
