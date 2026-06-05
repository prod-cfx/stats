//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'liquidation_summary_item_dto.g.dart';

/// LiquidationSummaryItemDto
///
/// Properties:
/// * [timeframe] - 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
/// * [totalUsd] - 该时间区间内的总爆仓金额（USD），long + short
/// * [longUsd] - 该时间区间内的多头爆仓金额（USD）
/// * [shortUsd] - 该时间区间内的空头爆仓金额（USD）
@BuiltValue()
abstract class LiquidationSummaryItemDto implements Built<LiquidationSummaryItemDto, LiquidationSummaryItemDtoBuilder> {
  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueField(wireName: r'timeframe')
  LiquidationSummaryItemDtoTimeframeEnum get timeframe;
  // enum timeframeEnum {  1h,  4h,  12h,  24h,  };

  /// 该时间区间内的总爆仓金额（USD），long + short
  @BuiltValueField(wireName: r'totalUsd')
  num get totalUsd;

  /// 该时间区间内的多头爆仓金额（USD）
  @BuiltValueField(wireName: r'longUsd')
  num get longUsd;

  /// 该时间区间内的空头爆仓金额（USD）
  @BuiltValueField(wireName: r'shortUsd')
  num get shortUsd;

  LiquidationSummaryItemDto._();

  factory LiquidationSummaryItemDto([void updates(LiquidationSummaryItemDtoBuilder b)]) = _$LiquidationSummaryItemDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LiquidationSummaryItemDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LiquidationSummaryItemDto> get serializer => _$LiquidationSummaryItemDtoSerializer();
}

class _$LiquidationSummaryItemDtoSerializer implements PrimitiveSerializer<LiquidationSummaryItemDto> {
  @override
  final Iterable<Type> types = const [LiquidationSummaryItemDto, _$LiquidationSummaryItemDto];

  @override
  final String wireName = r'LiquidationSummaryItemDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LiquidationSummaryItemDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'timeframe';
    yield serializers.serialize(
      object.timeframe,
      specifiedType: const FullType(LiquidationSummaryItemDtoTimeframeEnum),
    );
    yield r'totalUsd';
    yield serializers.serialize(
      object.totalUsd,
      specifiedType: const FullType(num),
    );
    yield r'longUsd';
    yield serializers.serialize(
      object.longUsd,
      specifiedType: const FullType(num),
    );
    yield r'shortUsd';
    yield serializers.serialize(
      object.shortUsd,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    LiquidationSummaryItemDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LiquidationSummaryItemDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'timeframe':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LiquidationSummaryItemDtoTimeframeEnum),
          ) as LiquidationSummaryItemDtoTimeframeEnum;
          result.timeframe = valueDes;
          break;
        case r'totalUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.totalUsd = valueDes;
          break;
        case r'longUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.longUsd = valueDes;
          break;
        case r'shortUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.shortUsd = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  LiquidationSummaryItemDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LiquidationSummaryItemDtoBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}

class LiquidationSummaryItemDtoTimeframeEnum extends EnumClass {

  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueEnumConst(wireName: r'1h')
  static const LiquidationSummaryItemDtoTimeframeEnum n1h = _$liquidationSummaryItemDtoTimeframeEnum_n1h;
  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueEnumConst(wireName: r'4h')
  static const LiquidationSummaryItemDtoTimeframeEnum n4h = _$liquidationSummaryItemDtoTimeframeEnum_n4h;
  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueEnumConst(wireName: r'12h')
  static const LiquidationSummaryItemDtoTimeframeEnum n12h = _$liquidationSummaryItemDtoTimeframeEnum_n12h;
  /// 时间区间（粒度），与 Coinglass interval 对齐，例如 1h/4h/12h/24h
  @BuiltValueEnumConst(wireName: r'24h')
  static const LiquidationSummaryItemDtoTimeframeEnum n24h = _$liquidationSummaryItemDtoTimeframeEnum_n24h;

  static Serializer<LiquidationSummaryItemDtoTimeframeEnum> get serializer => _$liquidationSummaryItemDtoTimeframeEnumSerializer;

  const LiquidationSummaryItemDtoTimeframeEnum._(String name): super(name);

  static BuiltSet<LiquidationSummaryItemDtoTimeframeEnum> get values => _$liquidationSummaryItemDtoTimeframeEnumValues;
  static LiquidationSummaryItemDtoTimeframeEnum valueOf(String name) => _$liquidationSummaryItemDtoTimeframeEnumValueOf(name);
}

