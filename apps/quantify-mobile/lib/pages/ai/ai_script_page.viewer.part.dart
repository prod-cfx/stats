part of 'ai_script_page.dart';
// ignore_for_file: unused_element

/// 脚本查看器：终端头部（红黄绿点 + 文件名 + READY badge + 复制）+ 行号 +
/// 语法高亮代码体 + 展开折叠。
class _ScriptViewer extends StatelessWidget {
  const _ScriptViewer({
    required this.script,
    required this.fileName,
    required this.copied,
    required this.expanded,
    required this.collapsedLines,
    required this.onToggleExpand,
    required this.onCopy,
  });

  final String script;
  final String fileName;
  final bool copied;
  final bool expanded;
  final int collapsedLines;
  final VoidCallback onToggleExpand;
  final VoidCallback onCopy;

  // 代码体固定深色背景，与设计稿 #1a1530 一致（不随主题反色）。
  static const Color _codeBg = Color(0xFF1A1530);

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<String> lines = script.split('\n');
    final bool hasMore = lines.length > collapsedLines;
    final List<String> shown = expanded
        ? lines
        : lines.take(collapsedLines).toList(growable: false);
    return Container(
      decoration: BoxDecoration(
        color: _codeBg,
        borderRadius: BorderRadius.circular(QzRadii.card),
        border: Border.all(color: c.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          // 终端风格头部
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.md,
              vertical: QzSpacing.sm,
            ),
            color: Colors.white.withValues(alpha: 0.04),
            child: Row(
              children: <Widget>[
                const _Dot(Color(0xFFFF5F57)),
                const SizedBox(width: QzSpacing.xs),
                const _Dot(Color(0xFFFEBC2E)),
                const SizedBox(width: QzSpacing.xs),
                const _Dot(Color(0xFF28C840)),
                const Spacer(),
                Text(
                  fileName,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontSize: 10,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
                const SizedBox(width: QzSpacing.sm),
                Container(
                  key: const Key('ai-script-ready-badge'),
                  padding: const EdgeInsets.symmetric(
                    horizontal: QzSpacing.xs,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16C783).withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    l10n.aiScriptReadyBadge,
                    style: const TextStyle(
                      color: Color(0xFF5EEAA8),
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
          // 代码体（行号 + 高亮）
          Padding(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.md,
              QzSpacing.sm,
              QzSpacing.md,
              QzSpacing.sm,
            ),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  for (int i = 0; i < shown.length; i++)
                    _CodeLine(number: i + 1, text: shown[i]),
                ],
              ),
            ),
          ),
          // 展开折叠
          if (hasMore)
            InkWell(
              key: const Key('ai-script-expand-toggle'),
              onTap: onToggleExpand,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: QzSpacing.sm),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.04),
                  border: Border(
                    top: BorderSide(
                      color: Colors.white.withValues(alpha: 0.06),
                    ),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    Icon(
                      expanded ? Icons.expand_less : Icons.expand_more,
                      size: 14,
                      color: const Color(0xFFA78BFA),
                    ),
                    const SizedBox(width: QzSpacing.xs),
                    Text(
                      expanded
                          ? l10n.aiScriptCollapse
                          : l10n.aiScriptExpand(lines.length),
                      style: const TextStyle(
                        color: Color(0xFFA78BFA),
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 单行代码：左侧灰色行号 + 右侧高亮文本。
class _CodeLine extends StatelessWidget {
  const _CodeLine({required this.number, required this.text});

  final int number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        SizedBox(
          width: 26,
          child: Text(
            '$number',
            textAlign: TextAlign.right,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.25),
              fontSize: 10,
              height: 1.6,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ),
        const SizedBox(width: 10),
        RichText(
          text: TextSpan(
            style: const TextStyle(
              fontSize: 11,
              height: 1.6,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
              color: Color(0xFFD9D5F0),
            ),
            children: _highlight(text),
          ),
        ),
      ],
    );
  }
}

/// 轻量 JS 语法高亮：行注释 / 字符串 / 关键字 / 数字。KISS，逐段切分。
List<InlineSpan> _highlight(String line) {
  const Color comment = Color(0xFF6B7280);
  const Color string = Color(0xFF86E1A0);
  const Color keyword = Color(0xFFC4B5FD);
  const Color number = Color(0xFFF0B96B);
  const Set<String> kw = <String>{
    'import',
    'from',
    'export',
    'default',
    'class',
    'extends',
    'static',
    'constructor',
    'return',
    'if',
    'else',
    'new',
    'this',
    'true',
    'false',
    'null',
    'undefined',
    'const',
    'let',
    'var',
    'async',
    'await',
    'function',
  };

  // 整行注释（以 // 开头，忽略前导空白）。脚本模板里注释均独占行或行尾，
  // 行尾注释场景少，做整行判定即可（KISS）。
  final int slash = line.indexOf('//');
  if (slash >= 0) {
    final String before = line.substring(0, slash);
    final bool noQuote =
        !before.contains('"') && !before.contains("'") && !before.contains('`');
    if (noQuote) {
      return <InlineSpan>[
        ..._highlightCode(before, kw, keyword, number),
        TextSpan(
          text: line.substring(slash),
          style: const TextStyle(color: comment, fontStyle: FontStyle.italic),
        ),
      ];
    }
  }
  return _highlightCode(line, kw, keyword, number, stringColor: string);
}

/// 高亮非注释片段：先切字符串，再对非字符串切关键字/数字。
List<InlineSpan> _highlightCode(
  String s,
  Set<String> kw,
  Color keyword,
  Color number, {
  Color stringColor = const Color(0xFF86E1A0),
}) {
  final List<InlineSpan> spans = <InlineSpan>[];
  final RegExp str = RegExp(
    r'''(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')''',
  );
  int last = 0;
  for (final RegExpMatch m in str.allMatches(s)) {
    if (m.start > last) {
      spans.addAll(
        _highlightTokens(s.substring(last, m.start), kw, keyword, number),
      );
    }
    spans.add(
      TextSpan(
        text: m.group(0),
        style: TextStyle(color: stringColor),
      ),
    );
    last = m.end;
  }
  if (last < s.length) {
    spans.addAll(_highlightTokens(s.substring(last), kw, keyword, number));
  }
  return spans;
}

/// 对纯代码片段切关键字与数字。
List<InlineSpan> _highlightTokens(
  String s,
  Set<String> kw,
  Color keyword,
  Color number,
) {
  final List<InlineSpan> spans = <InlineSpan>[];
  final RegExp token = RegExp(r'[A-Za-z_]\w*|\d+\.?\d*');
  int last = 0;
  for (final RegExpMatch m in token.allMatches(s)) {
    if (m.start > last) spans.add(TextSpan(text: s.substring(last, m.start)));
    final String t = m.group(0)!;
    if (kw.contains(t)) {
      spans.add(
        TextSpan(
          text: t,
          style: TextStyle(color: keyword, fontWeight: FontWeight.w600),
        ),
      );
    } else if (RegExp(r'^\d').hasMatch(t)) {
      spans.add(
        TextSpan(
          text: t,
          style: TextStyle(color: number),
        ),
      );
    } else {
      spans.add(TextSpan(text: t));
    }
    last = m.end;
  }
  if (last < s.length) spans.add(TextSpan(text: s.substring(last)));
  return spans;
}

class _Dot extends StatelessWidget {
  const _Dot(this.color);
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    width: 10,
    height: 10,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}

/// 底部行动条：上一步 + 下一步（仅就绪态可点）。
class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.ready,
    required this.prevLabel,
    required this.nextLabel,
    required this.onPrev,
    required this.onNext,
  });

  final bool ready;
  final String prevLabel;
  final String nextLabel;
  final VoidCallback onPrev;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.sm,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: OutlinedButton(
              key: const Key('ai-script-prev'),
              onPressed: onPrev,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                foregroundColor: c.text,
                side: BorderSide(color: c.border),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(QzRadii.card),
                ),
              ),
              child: Text(prevLabel),
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            flex: 2,
            child: FilledButton(
              key: const Key('ai-script-next-cta'),
              onPressed: ready ? onNext : null,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                backgroundColor: c.accent,
                disabledBackgroundColor: c.border,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(QzRadii.card),
                ),
              ),
              child: Text(nextLabel),
            ),
          ),
        ],
      ),
    );
  }
}
