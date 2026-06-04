import 'package:flutter/material.dart';

import 'dart:math' as math;

import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_sheet.dart';
part 'whale_detail_sort.label.part.dart';
part 'whale_detail_sort.filter.part.dart';

/// 详情页 5 个明细 tab 的排序/筛选交互原子（#1908）。
///
/// 设计真源：`design/project/mobile/m-screens-whale-discover.jsx` `TabBody`
/// （列头三态排序 :1166 / 币种筛选抽屉 CoinFilter :1992 / 更多排序抽屉
/// PerpMoreSort :1531）。
///
/// 排序键策略（KISS）：display 串带逗号的数值用 [whaleSortNum] 解析；
/// `time` 为相对时间文案（"少于一分钟前"）无法解析，调用方改用 fixture 行
/// 原始索引作为排序键（index 越小越新）。真实数据接入（#1682）时如需精确
/// 时间序，由后端保证顺序或补数值字段，属 #1682 范围。

