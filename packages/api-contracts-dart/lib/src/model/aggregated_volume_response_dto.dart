//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'aggregated_volume_response_dto.g.dart';

/// AggregatedVolumeResponseDto
///
/// Properties:
/// * [id] - 记录ID
/// * [exchange] - 交易所代码（All 表示聚合总量）
/// * [symbol] - 币种符号
/// * [instrumentType] - 合约类型
/// * [volumeUsd] - 24h 成交量（USD）
/// * [dataTimestamp] - 数据时间戳
/// * [source_] - 数据来源
/// * [createdAt] - 创建时间
/// * [updatedAt] - 更新时间
@BuiltValue()
abstract class AggregatedVolumeResponseDto implements Built<AggregatedVolumeResponseDto, AggregatedVolumeResponseDtoBuilder> {
  /// 记录ID
  @BuiltValueField(wireName: r'id')
  num get id;

  /// 交易所代码（All 表示聚合总量）
  @BuiltValueField(wireName: r'exchange')
  String get exchange;

  /// 币种符号
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 合约类型
  @BuiltValueField(wireName: r'instrumentType')
  AggregatedVolumeResponseDtoInstrumentTypeEnum? get instrumentType;
  // enum instrumentTypeEnum {  SPOT,  PERPETUAL,  };

  /// 24h 成交量（USD）
  @BuiltValueField(wireName: r'volumeUsd')
  String get volumeUsd;

  /// 数据时间戳
  @BuiltValueField(wireName: r'dataTimestamp')
  String get dataTimestamp;

  /// 数据来源
  @BuiltValueField(wireName: r'source')
  String get source_;

  /// 创建时间
  @BuiltValueField(wireName: r'createdAt')
  String get createdAt;

  /// 更新时间
  @BuiltValueField(wireName: r'updatedAt')
  String get updatedAt;

  AggregatedVolumeResponseDto._();

  factory AggregatedVolumeResponseDto([void updates(AggregatedVolumeResponseDtoBuilder b)]) = _$AggregatedVolumeResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AggregatedVolumeResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AggregatedVolumeResponseDto> get serializer => _$AggregatedVolumeResponseDtoSerializer();
}

class _$AggregatedVolumeResponseDtoSerializer implements PrimitiveSerializer<AggregatedVolumeResponseDto> {
  @override
  final Iterable<Type> types = const [AggregatedVolumeResponseDto, _$AggregatedVolumeResponseDto];

  @override
  final String wireName = r'AggregatedVolumeResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AggregatedVolumeResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(num),
    );
    yield r'exchange';
    yield serializers.serialize(
      object.exchange,
      specifiedType: const FullType(String),
    );
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    if (object.instrumentType != null) {
      yield r'instrumentType';
      yield serializers.serialize(
        object.instrumentType,
        specifiedType: const FullType(AggregatedVolumeResponseDtoInstrumentTypeEnum),
      );
    }
    yield r'volumeUsd';
    yield serializers.serialize(
      object.volumeUsd,
      specifiedType: const FullType(String),
    );
    yield r'dataTimestamp';
    yield serializers.serialize(
      object.dataTimestamp,
      specifiedType: const FullType(String),
    );
    yield r'source';
    yield serializers.serialize(
      object.source_,
      specifiedType: const FullType(String),
    );
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(String),
    );
    yield r'updatedAt';
    yield serializers.serialize(
      object.updatedAt,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AggregatedVolumeResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AggregatedVolumeResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.id = valueDes;
          break;
        case r'exchange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.exchange = valueDes;
          break;
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbol = valueDes;
          break;
        case r'instrumentType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AggregatedVolumeResponseDtoInstrumentTypeEnum),
          ) as AggregatedVolumeResponseDtoInstrumentTypeEnum;
          result.instrumentType = valueDes;
          break;
        case r'volumeUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.volumeUsd = valueDes;
          break;
        case r'dataTimestamp':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.dataTimestamp = valueDes;
          break;
        case r'source':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.source_ = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.createdAt = valueDes;
          break;
        case r'updatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.updatedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AggregatedVolumeResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AggregatedVolumeResponseDtoBuilder();
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

class AggregatedVolumeResponseDtoInstrumentTypeEnum extends EnumClass {

  /// 合约类型
  @BuiltValueEnumConst(wireName: r'SPOT')
  static const AggregatedVolumeResponseDtoInstrumentTypeEnum SPOT = _$aggregatedVolumeResponseDtoInstrumentTypeEnum_SPOT;
  /// 合约类型
  @BuiltValueEnumConst(wireName: r'PERPETUAL')
  static const AggregatedVolumeResponseDtoInstrumentTypeEnum PERPETUAL = _$aggregatedVolumeResponseDtoInstrumentTypeEnum_PERPETUAL;

  static Serializer<AggregatedVolumeResponseDtoInstrumentTypeEnum> get serializer => _$aggregatedVolumeResponseDtoInstrumentTypeEnumSerializer;

  const AggregatedVolumeResponseDtoInstrumentTypeEnum._(String name): super(name);

  static BuiltSet<AggregatedVolumeResponseDtoInstrumentTypeEnum> get values => _$aggregatedVolumeResponseDtoInstrumentTypeEnumValues;
  static AggregatedVolumeResponseDtoInstrumentTypeEnum valueOf(String name) => _$aggregatedVolumeResponseDtoInstrumentTypeEnumValueOf(name);
}

