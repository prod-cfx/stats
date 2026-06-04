import 'package:flutter/material.dart';

import '../../../data/models/whale_profile_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
part 'whale_detail_rows.shared.part.dart';
part 'whale_detail_rows.rows.part.dart';

/// 6 tab 详情明细行（设计稿 `WhaleProfileDetail` 各 tab body）。
///
/// 统一结构：coin 头（圆形字形 + symbol + side/状态 chip）+ 标签化数据网格。
/// mock fixtures 每 tab 固定 3 行，不实现排序/筛选（KISS/YAGNI）。

Color _toneColor(QzColorScheme c, double n) =>
    n >= 0 ? c.marketUp : c.marketDown;

