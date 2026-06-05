//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_alert_side.g.dart';

class WhaleAlertSide extends EnumClass {

  /// 持仓方向：Long / Short（由 position_size 正负推导，>= 0 视为 Long，< 0 视为 Short）
  @BuiltValueEnumConst(wireName: r'Long')
  static const WhaleAlertSide long = _$long;
  /// 持仓方向：Long / Short（由 position_size 正负推导，>= 0 视为 Long，< 0 视为 Short）
  @BuiltValueEnumConst(wireName: r'Short')
  static const WhaleAlertSide short = _$short;

  static Serializer<WhaleAlertSide> get serializer => _$whaleAlertSideSerializer;

  const WhaleAlertSide._(String name): super(name);

  static BuiltSet<WhaleAlertSide> get values => _$values;
  static WhaleAlertSide valueOf(String name) => _$valueOf(name);
}

/// Optionally, enum_class can generate a mixin to go with your enum for use
/// with Angular. It exposes your enum constants as getters. So, if you mix it
/// in to your Dart component class, the values become available to the
/// corresponding Angular template.
///
/// Trigger mixin generation by writing a line like this one next to your enum.
abstract class WhaleAlertSideMixin = Object with _$WhaleAlertSideMixin;

