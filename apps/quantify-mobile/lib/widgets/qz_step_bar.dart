import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// AI 量化向导 5 步流程条 — 对齐设计稿 `BtcStepBar`
/// (`design/project/mobile/m-screens-btconfig.jsx#BtcStepBar`)。
///
/// 五步线性流程：确认策略 → 策略脚本 → 回测设置 → 回测 → 部署。
/// 用于 confirm / script / btconfig / btres / deploy 等向导页顶栏下方，
/// 复用同一形态：
///   - tab 风格 5 等分网格，mono 序号 `0N` + 完整中文标签
///   - [active] 步：序号/下划线 accent，标签 [text] 700
///   - done 步：序号换成对勾（accent），标签 [textMid]，可点击回跳
///   - 未达成步：序号 [textFaint]，标签 [textDim]
///
/// 设计稿 `done` 步可点击回跳已完成步骤；通过 [onStepTap] 回调暴露，
/// 仅 done 步触发（confirm 页 done 为空，故无回跳）。
class QzStepBar extends StatelessWidget {
  const QzStepBar({
    super.key,
    required this.steps,
    required this.active,
    this.done = const <int>[],
    this.onStepTap,
  });

  /// 各步标签（顺序即步骤序）。
  final List<String> steps;

  /// 当前 active 步索引（0-based）。
  final int active;

  /// 已完成步索引集合（显示对勾，可点击回跳）。
  final List<int> done;

  /// done 步点击回调，参数为步索引。null 时不可点击。
  final ValueChanged<int>? onStepTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      key: const Key('qz-step-bar'),
      decoration: BoxDecoration(
        color: c.bg,
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
      child: Row(
        children: <Widget>[
          for (int i = 0; i < steps.length; i++)
            Expanded(
              child: _Step(
                index: i,
                label: steps[i],
                active: i == active,
                done: done.contains(i),
                onTap: (onStepTap != null && done.contains(i))
                    ? () => onStepTap!(i)
                    : null,
              ),
            ),
        ],
      ),
    );
  }
}

/// 单步：mono 序号/对勾 + 标签 + active 下划线。
class _Step extends StatelessWidget {
  const _Step({
    required this.index,
    required this.label,
    required this.active,
    required this.done,
    this.onTap,
  });

  final int index;
  final String label;
  final bool active;
  final bool done;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color labelColor = active
        ? c.text
        : done
        ? c.textMid
        : c.textDim;
    final Color numColor = active || done ? c.accent : c.textFaint;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        // 下划线覆盖容器底边框，active 状态用 accent 替换。
        transform: Matrix4.translationValues(0, 1, 0),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: active ? c.accent : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(4, 11, 4, 9),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            SizedBox(
              height: 13,
              child: Center(
                child: done
                    ? Icon(Icons.check_rounded, size: 12, color: c.accent)
                    : Text(
                        '0${index + 1}',
                        style: TextStyle(
                          fontFamily: QzFont.mono,
                          fontFamilyFallback: QzFont.monoFallback,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: numColor,
                          letterSpacing: 0.3,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: labelColor,
                letterSpacing: 0,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
