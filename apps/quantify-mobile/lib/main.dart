import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.portraitUp,
  ]);
  runApp(const QuantifyMobileApp());
}

class QuantifyMobileApp extends StatelessWidget {
  const QuantifyMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'Quantify',
      home: Scaffold(
        body: Center(
          child: Text('Quantify'),
        ),
      ),
    );
  }
}
