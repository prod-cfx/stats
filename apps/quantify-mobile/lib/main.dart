import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
// `Override` 在 Riverpod 3.x 未由 flutter_riverpod 公开导出，直连 misc。
import 'package:riverpod/misc.dart' show Override;
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'data/auth/session_controller.dart';
import 'l10n/app_localizations.dart';
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

  final ProviderContainer container = ProviderContainer(
    // Riverpod 3.x 默认在 provider build 抛错时按指数退避自动重试，会让
    // repository / mock 失败被框架静默重试、改变 2.6.1 「一次失败即落错误态」
    // 语义。统一关闭 retry，保持升级前行为（Never break userspace）；个别需
    // retry 的 provider 应在定义处显式打开并配测试。
    retry: (_, _) => null,
    overrides: <Override>[
      sharedPreferencesProvider.overrideWithValue(prefs),
    ],
  );

  // 等 SessionController 从 secure storage 恢复完毕，再启动 router；
  // 否则 GoRouter 同步 redirect 第一帧会拿到 null（未登录）误判。
  await container.read(sessionControllerProvider.future);

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const QuantifyMobileApp(),
    ),
  );
}

class QuantifyMobileApp extends ConsumerStatefulWidget {
  const QuantifyMobileApp({super.key});

  @override
  ConsumerState<QuantifyMobileApp> createState() => _QuantifyMobileAppState();
}

class _QuantifyMobileAppState extends ConsumerState<QuantifyMobileApp> {
  late final ValueNotifier<int> _refresh;
  late final GoRouter _router;
  ProviderSubscription<AsyncValue<Object?>>? _sub;

  @override
  void initState() {
    super.initState();
    _refresh = ValueNotifier<int>(0);
    // session 变化时碰一下 notifier，让 GoRouter 重新跑 redirect。
    _sub = ref.listenManual<AsyncValue<Object?>>(
      sessionControllerProvider,
      (AsyncValue<Object?>? prev, AsyncValue<Object?> next) {
        _refresh.value++;
      },
    );
    _router = buildRouter(
      readSession: () =>
          ref.read(sessionControllerProvider).value,
      refreshListenable: _refresh,
    );
  }

  @override
  void dispose() {
    _sub?.close();
    _refresh.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final QzTheme theme = ref.watch(themeProvider);
    return MaterialApp.router(
      title: 'Quantify',
      theme: buildQzThemeData(theme),
      routerConfig: _router,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      // 当前硬锁中文；后续支持系统语言跟随时移除此行（tracking #1515 follow-up）
      locale: const Locale('zh'),
    );
  }
}
