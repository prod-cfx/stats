import 'package:flutter_test/flutter_test.dart';

import 'package:quantify_mobile/main.dart';

void main() {
  testWidgets('renders Quantify landing text', (WidgetTester tester) async {
    await tester.pumpWidget(const QuantifyMobileApp());
    await tester.pumpAndSettle();

    expect(find.text('Quantify'), findsOneWidget);
  });
}
