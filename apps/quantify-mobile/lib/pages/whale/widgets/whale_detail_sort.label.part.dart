part of 'whale_detail_sort.dart';
// ignore_for_file: unused_element

/// 三态排序方向。null（不排序）由 [WhaleSortState.dir] 为 null 表达。
enum WhaleSortDir { asc, desc }

/// 单 tab 的排序状态：列 key + 方向。两者同时为 null 表示「不排序」。
@immutable
class WhaleSortState {
  const WhaleSortState({this.key, this.dir});

  final String? key;
  final WhaleSortDir? dir;

  bool get active => key != null && dir != null;

  /// 列头三态循环：新列→desc；desc→asc；asc→不排序。
  WhaleSortState cycle(String tappedKey) {
    if (key != tappedKey) {
      return WhaleSortState(key: tappedKey, dir: WhaleSortDir.desc);
    }
    if (dir == WhaleSortDir.desc) {
      return WhaleSortState(key: tappedKey, dir: WhaleSortDir.asc);
    }
    return const WhaleSortState();
  }
}

/// display 串 → 排序用数值。去逗号与货币/单位符号后 `double.tryParse`，
/// 解析失败回退 0（不排序列不会调用，故无副作用）。
double whaleSortNum(String display) {
  final String cleaned = display.replaceAll(RegExp(r'[^0-9.\-]'), '');
  return double.tryParse(cleaned) ?? 0;
}

/// 列头三态排序标签（上下 caret，active 紫色）。
class WhaleSortLabel extends StatelessWidget {
  const WhaleSortLabel({
    super.key,
    required this.label,
    required this.dir,
    required this.onTap,
  });

  final String label;

  /// 当前列方向；null 表示该列未参与排序。
  final WhaleSortDir? dir;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool active = dir != null;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              color: active ? c.accent : c.textDim,
            ),
          ),
          const SizedBox(width: 4),
          _SortCaret(dir: dir, accent: c.accent, faint: c.textFaint),
        ],
      ),
    );
  }
}

class _SortCaret extends StatelessWidget {
  const _SortCaret({
    required this.dir,
    required this.accent,
    required this.faint,
  });

  final WhaleSortDir? dir;
  final Color accent;
  final Color faint;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 10,
      height: 14,
      child: CustomPaint(
        painter: _SortCaretPainter(
          up: dir == WhaleSortDir.asc ? accent : faint,
          down: dir == WhaleSortDir.desc ? accent : faint,
        ),
      ),
    );
  }
}

class _SortCaretPainter extends CustomPainter {
  const _SortCaretPainter({required this.up, required this.down});

  final Color up;
  final Color down;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()..style = PaintingStyle.fill;
    final double cx = size.width / 2;
    paint.color = up;
    canvas.drawPath(
      Path()
        ..moveTo(cx, 1)
        ..lineTo(cx - 4, 6)
        ..lineTo(cx + 4, 6)
        ..close(),
      paint,
    );
    paint.color = down;
    canvas.drawPath(
      Path()
        ..moveTo(cx - 4, 8)
        ..lineTo(cx + 4, 8)
        ..lineTo(cx, 13)
        ..close(),
      paint,
    );
  }

  @override
  bool shouldRepaint(_SortCaretPainter oldDelegate) =>
      oldDelegate.up != up || oldDelegate.down != down;
}
