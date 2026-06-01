import 'package:flutter/material.dart';

/// 底部居中浮层 toast，对齐设计稿
/// `m-screens-whale-discover.jsx:591-599`：固定底部约 120px、圆角 999、
/// 半透明黑底 `rgba(15,11,34,0.92)`、fontSize 12、不拦截手势。
///
/// 通过 [QzToast.show] 以 Overlay 形式弹出，自动在 [duration] 后淡出移除，
/// 调用方无需维护本地状态。巨鲸发现页与详情页复制地址提示共用此实现，
/// 保证两处视觉/行为一致。
class QzToast {
  const QzToast._();

  /// 底部距离，贴近设计稿的 `bottom:120`。
  static const double _bottomInset = 120;

  /// 在最近的 [Overlay] 上弹出一个浮层 toast。
  static void show(
    BuildContext context,
    String message, {
    Duration duration = const Duration(seconds: 1),
  }) {
    final OverlayState? overlay = Overlay.maybeOf(context);
    if (overlay == null) return;

    late final OverlayEntry entry;
    entry = OverlayEntry(
      builder: (BuildContext context) => _QzToastView(
        message: message,
        duration: duration,
        bottomInset: _bottomInset,
        onDismissed: () => entry.remove(),
      ),
    );
    overlay.insert(entry);
  }
}

/// 浮层内容 + 淡入淡出动画；动画结束后回调 [onDismissed] 移除 entry。
class _QzToastView extends StatefulWidget {
  const _QzToastView({
    required this.message,
    required this.duration,
    required this.bottomInset,
    required this.onDismissed,
  });

  final String message;
  final Duration duration;
  final double bottomInset;
  final VoidCallback onDismissed;

  @override
  State<_QzToastView> createState() => _QzToastViewState();
}

class _QzToastViewState extends State<_QzToastView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 180),
  );

  @override
  void initState() {
    super.initState();
    _controller.forward();
    Future<void>.delayed(widget.duration, _dismiss);
  }

  Future<void> _dismiss() async {
    if (!mounted) return;
    await _controller.reverse();
    widget.onDismissed();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 0,
      right: 0,
      bottom: widget.bottomInset + MediaQuery.of(context).padding.bottom,
      child: IgnorePointer(
        child: FadeTransition(
          opacity: _controller,
          child: Center(
            child: Material(
              color: Colors.transparent,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xEB0F0B22), // rgba(15,11,34,0.92)
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  widget.message,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
