//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'dart:core';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';
import 'package:one_of/one_of.dart';

part 'liquidation_heatmap_response_dto_price_candlesticks_inner_inner.g.dart';

/// LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner
@BuiltValue()
abstract class LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner implements Built<LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner, LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder> {
  /// One Of [String], [num]
  OneOf get oneOf;

  LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner._();

  factory LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner([void updates(LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder b)]) = _$LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner> get serializer => _$LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerSerializer();
}

class _$LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerSerializer implements PrimitiveSerializer<LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner> {
  @override
  final Iterable<Type> types = const [LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner, _$LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner];

  @override
  final String wireName = r'LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
  }

  @override
  Object serialize(
    Serializers serializers,
    LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final oneOf = object.oneOf;
    return serializers.serialize(oneOf.value, specifiedType: FullType(oneOf.valueType))!;
  }

  @override
  LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder();
    Object? oneOfDataSrc;
    final targetType = const FullType(OneOf, [FullType(num), FullType(String), ]);
    oneOfDataSrc = serialized;
    result.oneOf = serializers.deserialize(oneOfDataSrc, specifiedType: targetType) as OneOf;
    return result.build();
  }
}

