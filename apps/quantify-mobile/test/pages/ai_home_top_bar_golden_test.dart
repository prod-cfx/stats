import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/widgets/qz_ai_top_bar.dart';

import '../helpers/golden_harness.dart';

/// Golden 快照测试：AI 量化顶栏（#2023）。
///
/// PR #2019 已交付属性断言 widget 测试（32×32 / borderRadius 9·999 / bgSoft /
/// glyph 存在 / 14·w700·-0.2 标题），覆盖「样式正确」意图，但无法捕获描边 /
/// 留白 / 抗锯齿等像素层差异。本文件补真正的 `matchesGoldenFile` 图像快照，
/// 覆盖两种顶栏态：
///   1. 占位「AI」态（[QzAiTopBar.title] == null）
///   2. 会话态（title + subtitle 双行）
///
/// 顶栏已从 `AiHomePage` 内联 AppBar 抽出为独立 [QzAiTopBar]，得以脱离整页
/// pump / 动画 spinner / 聊天内容，直接对顶栏做确定性像素比对。与 PR #2019 的
/// 属性断言互补保留，不替换。
final Uri _testFile = Uri.parse(
  'test/pages/ai_home_top_bar_golden_test.dart',
);

/// 与 qz_empty_state_test.dart 一致的容差，吸收跨环境 SDK 渲染像素漂移。
const double _sdkPixelDriftTolerance = 0.0002;

/// 顶栏画布：宽 400 容纳左右按钮 + 标题；高 80 覆盖 kToolbarHeight(56)。
const Size _surfaceSize = Size(400, 80);

QzAiTopBar _buildTopBar({String? title, String? subtitle}) => QzAiTopBar(
      title: title,
      subtitle: subtitle,
      historyTooltip: '历史',
      newSessionTooltip: '新建会话',
      onOpenHistory: () {},
      onNewSession: () {},
    );

void main() {
  testWidgets('QzAiTopBar golden — 占位「AI」态（title == null）', (tester) async {
    await pumpQz(
      tester,
      Scaffold(appBar: _buildTopBar()),
      surfaceSize: _surfaceSize,
    );
    expect(find.text('AI'), findsOneWidget);
    await expectGoldenWithinTolerance(
      find.byType(QzAiTopBar),
      'goldens/ai_home_top_bar_placeholder.png',
      testFile: _testFile,
      precisionTolerance: _sdkPixelDriftTolerance,
    );
  });

  testWidgets('QzAiTopBar golden — 会话态（title + subtitle）', (tester) async {
    await pumpQz(
      tester,
      Scaffold(
        appBar: _buildTopBar(
          title: 'BTC 趋势 · 双均线',
          subtitle: '趋势 · BTC/USDT · 15m',
        ),
      ),
      surfaceSize: _surfaceSize,
    );
    expect(find.text('BTC 趋势 · 双均线'), findsOneWidget);
    expect(find.text('趋势 · BTC/USDT · 15m'), findsOneWidget);
    await expectGoldenWithinTolerance(
      find.byType(QzAiTopBar),
      'goldens/ai_home_top_bar_session.png',
      testFile: _testFile,
      precisionTolerance: _sdkPixelDriftTolerance,
    );
  });

  testWidgets('QzAiTopBar 两种态在 9 主题下渲染无异常', (tester) async {
    await verifyAllThemes(
      tester,
      () => Scaffold(appBar: _buildTopBar()),
      (t) async {
        expect(find.text('AI'), findsOneWidget);
      },
      surfaceSize: _surfaceSize,
    );
    await verifyAllThemes(
      tester,
      () => Scaffold(
        appBar: _buildTopBar(title: 'BTC 趋势 · 双均线', subtitle: '趋势 · 15m'),
      ),
      (t) async {
        expect(find.text('BTC 趋势 · 双均线'), findsOneWidget);
      },
      surfaceSize: _surfaceSize,
    );
  });
}
