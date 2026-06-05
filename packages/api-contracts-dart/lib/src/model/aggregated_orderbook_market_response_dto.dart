//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'aggregated_orderbook_market_response_dto.g.dart';

/// AggregatedOrderbookMarketResponseDto
///
/// Properties:
/// * [base_] - 基础资产
/// * [type] - 市场类型
/// * [venues] - 该币对可用交易所
@BuiltValue()
abstract class AggregatedOrderbookMarketResponseDto implements Built<AggregatedOrderbookMarketResponseDto, AggregatedOrderbookMarketResponseDtoBuilder> {
  /// 基础资产
  @BuiltValueField(wireName: r'base')
  String get base_;

  /// 市场类型
  @BuiltValueField(wireName: r'type')
  AggregatedOrderbookMarketResponseDtoTypeEnum get type;
  // enum typeEnum {  spot,  perp,  };

  /// 该币对可用交易所
  @BuiltValueField(wireName: r'venues')
  BuiltList<String> get venues;

  AggregatedOrderbookMarketResponseDto._();

  factory AggregatedOrderbookMarketResponseDto([void updates(AggregatedOrderbookMarketResponseDtoBuilder b)]) = _$AggregatedOrderbookMarketResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AggregatedOrderbookMarketResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AggregatedOrderbookMarketResponseDto> get serializer => _$AggregatedOrderbookMarketResponseDtoSerializer();
}

class _$AggregatedOrderbookMarketResponseDtoSerializer implements PrimitiveSerializer<AggregatedOrderbookMarketResponseDto> {
  @override
  final Iterable<Type> types = const [AggregatedOrderbookMarketResponseDto, _$AggregatedOrderbookMarketResponseDto];

  @override
  final String wireName = r'AggregatedOrderbookMarketResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AggregatedOrderbookMarketResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'base';
    yield serializers.serialize(
      object.base_,
      specifiedType: const FullType(String),
    );
    yield r'type';
    yield serializers.serialize(
      object.type,
      specifiedType: const FullType(AggregatedOrderbookMarketResponseDtoTypeEnum),
    );
    yield r'venues';
    yield serializers.serialize(
      object.venues,
      specifiedType: const FullType(BuiltList, [FullType(String)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AggregatedOrderbookMarketResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AggregatedOrderbookMarketResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'base':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.base_ = valueDes;
          break;
        case r'type':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AggregatedOrderbookMarketResponseDtoTypeEnum),
          ) as AggregatedOrderbookMarketResponseDtoTypeEnum;
          result.type = valueDes;
          break;
        case r'venues':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.venues.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AggregatedOrderbookMarketResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AggregatedOrderbookMarketResponseDtoBuilder();
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

class AggregatedOrderbookMarketResponseDtoTypeEnum extends EnumClass {

  /// 市场类型
  @BuiltValueEnumConst(wireName: r'spot')
  static const AggregatedOrderbookMarketResponseDtoTypeEnum spot = _$aggregatedOrderbookMarketResponseDtoTypeEnum_spot;
  /// 市场类型
  @BuiltValueEnumConst(wireName: r'perp')
  static const AggregatedOrderbookMarketResponseDtoTypeEnum perp = _$aggregatedOrderbookMarketResponseDtoTypeEnum_perp;

  static Serializer<AggregatedOrderbookMarketResponseDtoTypeEnum> get serializer => _$aggregatedOrderbookMarketResponseDtoTypeEnumSerializer;

  const AggregatedOrderbookMarketResponseDtoTypeEnum._(String name): super(name);

  static BuiltSet<AggregatedOrderbookMarketResponseDtoTypeEnum> get values => _$aggregatedOrderbookMarketResponseDtoTypeEnumValues;
  static AggregatedOrderbookMarketResponseDtoTypeEnum valueOf(String name) => _$aggregatedOrderbookMarketResponseDtoTypeEnumValueOf(name);
}

