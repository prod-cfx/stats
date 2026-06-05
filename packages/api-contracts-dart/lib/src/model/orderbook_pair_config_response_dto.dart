//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'orderbook_pair_config_response_dto.g.dart';

/// OrderbookPairConfigResponseDto
///
/// Properties:
/// * [id] - 配置ID
/// * [pairId] - 交易对唯一标识
/// * [venue] - 交易所/DEX 标识
/// * [symbol] - 交易对符号
/// * [baseAsset] - 基础资产
/// * [quoteAsset] - 计价资产
/// * [venueType] - 交易场所类型
/// * [instrumentType] - 交易品种类型
/// * [enabled] - 是否启用
/// * [pullIntervalSeconds] - 拉取频率（秒）
/// * [depthLevels] - 深度层级
/// * [priority] - 优先级
/// * [metadata] - 扩展配置
/// * [description] - 备注说明
/// * [createdAt] - 创建时间
/// * [updatedAt] - 更新时间
@BuiltValue()
abstract class OrderbookPairConfigResponseDto implements Built<OrderbookPairConfigResponseDto, OrderbookPairConfigResponseDtoBuilder> {
  /// 配置ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 交易对唯一标识
  @BuiltValueField(wireName: r'pairId')
  String get pairId;

  /// 交易所/DEX 标识
  @BuiltValueField(wireName: r'venue')
  String get venue;

  /// 交易对符号
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 基础资产
  @BuiltValueField(wireName: r'baseAsset')
  String get baseAsset;

  /// 计价资产
  @BuiltValueField(wireName: r'quoteAsset')
  String get quoteAsset;

  /// 交易场所类型
  @BuiltValueField(wireName: r'venueType')
  OrderbookPairConfigResponseDtoVenueTypeEnum get venueType;
  // enum venueTypeEnum {  CEX,  DEX,  };

  /// 交易品种类型
  @BuiltValueField(wireName: r'instrumentType')
  OrderbookPairConfigResponseDtoInstrumentTypeEnum get instrumentType;
  // enum instrumentTypeEnum {  SPOT,  PERPETUAL,  FUTURE,  };

  /// 是否启用
  @BuiltValueField(wireName: r'enabled')
  bool get enabled;

  /// 拉取频率（秒）
  @BuiltValueField(wireName: r'pullIntervalSeconds')
  num? get pullIntervalSeconds;

  /// 深度层级
  @BuiltValueField(wireName: r'depthLevels')
  num? get depthLevels;

  /// 优先级
  @BuiltValueField(wireName: r'priority')
  num get priority;

  /// 扩展配置
  @BuiltValueField(wireName: r'metadata')
  JsonObject? get metadata;

  /// 备注说明
  @BuiltValueField(wireName: r'description')
  String? get description;

  /// 创建时间
  @BuiltValueField(wireName: r'createdAt')
  DateTime get createdAt;

  /// 更新时间
  @BuiltValueField(wireName: r'updatedAt')
  DateTime get updatedAt;

  OrderbookPairConfigResponseDto._();

  factory OrderbookPairConfigResponseDto([void updates(OrderbookPairConfigResponseDtoBuilder b)]) = _$OrderbookPairConfigResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OrderbookPairConfigResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<OrderbookPairConfigResponseDto> get serializer => _$OrderbookPairConfigResponseDtoSerializer();
}

class _$OrderbookPairConfigResponseDtoSerializer implements PrimitiveSerializer<OrderbookPairConfigResponseDto> {
  @override
  final Iterable<Type> types = const [OrderbookPairConfigResponseDto, _$OrderbookPairConfigResponseDto];

  @override
  final String wireName = r'OrderbookPairConfigResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    OrderbookPairConfigResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'pairId';
    yield serializers.serialize(
      object.pairId,
      specifiedType: const FullType(String),
    );
    yield r'venue';
    yield serializers.serialize(
      object.venue,
      specifiedType: const FullType(String),
    );
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'baseAsset';
    yield serializers.serialize(
      object.baseAsset,
      specifiedType: const FullType(String),
    );
    yield r'quoteAsset';
    yield serializers.serialize(
      object.quoteAsset,
      specifiedType: const FullType(String),
    );
    yield r'venueType';
    yield serializers.serialize(
      object.venueType,
      specifiedType: const FullType(OrderbookPairConfigResponseDtoVenueTypeEnum),
    );
    yield r'instrumentType';
    yield serializers.serialize(
      object.instrumentType,
      specifiedType: const FullType(OrderbookPairConfigResponseDtoInstrumentTypeEnum),
    );
    yield r'enabled';
    yield serializers.serialize(
      object.enabled,
      specifiedType: const FullType(bool),
    );
    if (object.pullIntervalSeconds != null) {
      yield r'pullIntervalSeconds';
      yield serializers.serialize(
        object.pullIntervalSeconds,
        specifiedType: const FullType.nullable(num),
      );
    }
    if (object.depthLevels != null) {
      yield r'depthLevels';
      yield serializers.serialize(
        object.depthLevels,
        specifiedType: const FullType.nullable(num),
      );
    }
    yield r'priority';
    yield serializers.serialize(
      object.priority,
      specifiedType: const FullType(num),
    );
    if (object.metadata != null) {
      yield r'metadata';
      yield serializers.serialize(
        object.metadata,
        specifiedType: const FullType.nullable(JsonObject),
      );
    }
    if (object.description != null) {
      yield r'description';
      yield serializers.serialize(
        object.description,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'updatedAt';
    yield serializers.serialize(
      object.updatedAt,
      specifiedType: const FullType(DateTime),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    OrderbookPairConfigResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OrderbookPairConfigResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'pairId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.pairId = valueDes;
          break;
        case r'venue':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.venue = valueDes;
          break;
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbol = valueDes;
          break;
        case r'baseAsset':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.baseAsset = valueDes;
          break;
        case r'quoteAsset':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.quoteAsset = valueDes;
          break;
        case r'venueType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(OrderbookPairConfigResponseDtoVenueTypeEnum),
          ) as OrderbookPairConfigResponseDtoVenueTypeEnum;
          result.venueType = valueDes;
          break;
        case r'instrumentType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(OrderbookPairConfigResponseDtoInstrumentTypeEnum),
          ) as OrderbookPairConfigResponseDtoInstrumentTypeEnum;
          result.instrumentType = valueDes;
          break;
        case r'enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.enabled = valueDes;
          break;
        case r'pullIntervalSeconds':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.pullIntervalSeconds = valueDes;
          break;
        case r'depthLevels':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.depthLevels = valueDes;
          break;
        case r'priority':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.priority = valueDes;
          break;
        case r'metadata':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(JsonObject),
          ) as JsonObject?;
          if (valueDes == null) continue;
          result.metadata = valueDes;
          break;
        case r'description':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.description = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.createdAt = valueDes;
          break;
        case r'updatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
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
  OrderbookPairConfigResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OrderbookPairConfigResponseDtoBuilder();
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

class OrderbookPairConfigResponseDtoVenueTypeEnum extends EnumClass {

  /// 交易场所类型
  @BuiltValueEnumConst(wireName: r'CEX')
  static const OrderbookPairConfigResponseDtoVenueTypeEnum CEX = _$orderbookPairConfigResponseDtoVenueTypeEnum_CEX;
  /// 交易场所类型
  @BuiltValueEnumConst(wireName: r'DEX')
  static const OrderbookPairConfigResponseDtoVenueTypeEnum DEX = _$orderbookPairConfigResponseDtoVenueTypeEnum_DEX;

  static Serializer<OrderbookPairConfigResponseDtoVenueTypeEnum> get serializer => _$orderbookPairConfigResponseDtoVenueTypeEnumSerializer;

  const OrderbookPairConfigResponseDtoVenueTypeEnum._(String name): super(name);

  static BuiltSet<OrderbookPairConfigResponseDtoVenueTypeEnum> get values => _$orderbookPairConfigResponseDtoVenueTypeEnumValues;
  static OrderbookPairConfigResponseDtoVenueTypeEnum valueOf(String name) => _$orderbookPairConfigResponseDtoVenueTypeEnumValueOf(name);
}

class OrderbookPairConfigResponseDtoInstrumentTypeEnum extends EnumClass {

  /// 交易品种类型
  @BuiltValueEnumConst(wireName: r'SPOT')
  static const OrderbookPairConfigResponseDtoInstrumentTypeEnum SPOT = _$orderbookPairConfigResponseDtoInstrumentTypeEnum_SPOT;
  /// 交易品种类型
  @BuiltValueEnumConst(wireName: r'PERPETUAL')
  static const OrderbookPairConfigResponseDtoInstrumentTypeEnum PERPETUAL = _$orderbookPairConfigResponseDtoInstrumentTypeEnum_PERPETUAL;
  /// 交易品种类型
  @BuiltValueEnumConst(wireName: r'FUTURE')
  static const OrderbookPairConfigResponseDtoInstrumentTypeEnum FUTURE = _$orderbookPairConfigResponseDtoInstrumentTypeEnum_FUTURE;

  static Serializer<OrderbookPairConfigResponseDtoInstrumentTypeEnum> get serializer => _$orderbookPairConfigResponseDtoInstrumentTypeEnumSerializer;

  const OrderbookPairConfigResponseDtoInstrumentTypeEnum._(String name): super(name);

  static BuiltSet<OrderbookPairConfigResponseDtoInstrumentTypeEnum> get values => _$orderbookPairConfigResponseDtoInstrumentTypeEnumValues;
  static OrderbookPairConfigResponseDtoInstrumentTypeEnum valueOf(String name) => _$orderbookPairConfigResponseDtoInstrumentTypeEnumValueOf(name);
}

