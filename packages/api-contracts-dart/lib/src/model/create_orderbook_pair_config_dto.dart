//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_orderbook_pair_config_dto.g.dart';

/// CreateOrderbookPairConfigDto
///
/// Properties:
/// * [pairId] - 交易对唯一标识，格式: SYMBOL.VENUE.INSTRUMENT_TYPE（全大写），例如 BTCUSDT.BINANCE.SPOT
/// * [venue] - 交易所/DEX 标识，例如 BINANCE, OKX, UNISWAP_V3
/// * [symbol] - 交易对符号，例如 BTCUSDT
/// * [baseAsset] - 基础资产，例如 BTC
/// * [quoteAsset] - 计价资产，例如 USDT
/// * [venueType] - 交易场所类型
/// * [instrumentType] - 交易品种类型
/// * [enabled] - 是否启用拉取
/// * [pullIntervalSeconds] - 拉取频率（秒），null 表示使用全局默认值
/// * [depthLevels] - 深度层级（买卖各多少档）
/// * [priority] - 优先级（数字越小优先级越高）
/// * [metadata] - 扩展配置（JSON格式）
/// * [description] - 备注说明
@BuiltValue()
abstract class CreateOrderbookPairConfigDto implements Built<CreateOrderbookPairConfigDto, CreateOrderbookPairConfigDtoBuilder> {
  /// 交易对唯一标识，格式: SYMBOL.VENUE.INSTRUMENT_TYPE（全大写），例如 BTCUSDT.BINANCE.SPOT
  @BuiltValueField(wireName: r'pairId')
  String get pairId;

  /// 交易所/DEX 标识，例如 BINANCE, OKX, UNISWAP_V3
  @BuiltValueField(wireName: r'venue')
  String get venue;

  /// 交易对符号，例如 BTCUSDT
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 基础资产，例如 BTC
  @BuiltValueField(wireName: r'baseAsset')
  String get baseAsset;

  /// 计价资产，例如 USDT
  @BuiltValueField(wireName: r'quoteAsset')
  String get quoteAsset;

  /// 交易场所类型
  @BuiltValueField(wireName: r'venueType')
  CreateOrderbookPairConfigDtoVenueTypeEnum get venueType;
  // enum venueTypeEnum {  CEX,  DEX,  };

  /// 交易品种类型
  @BuiltValueField(wireName: r'instrumentType')
  CreateOrderbookPairConfigDtoInstrumentTypeEnum get instrumentType;
  // enum instrumentTypeEnum {  SPOT,  PERPETUAL,  FUTURE,  };

  /// 是否启用拉取
  @BuiltValueField(wireName: r'enabled')
  bool? get enabled;

  /// 拉取频率（秒），null 表示使用全局默认值
  @BuiltValueField(wireName: r'pullIntervalSeconds')
  num? get pullIntervalSeconds;

  /// 深度层级（买卖各多少档）
  @BuiltValueField(wireName: r'depthLevels')
  num? get depthLevels;

  /// 优先级（数字越小优先级越高）
  @BuiltValueField(wireName: r'priority')
  num? get priority;

  /// 扩展配置（JSON格式）
  @BuiltValueField(wireName: r'metadata')
  JsonObject? get metadata;

  /// 备注说明
  @BuiltValueField(wireName: r'description')
  String? get description;

  CreateOrderbookPairConfigDto._();

  factory CreateOrderbookPairConfigDto([void updates(CreateOrderbookPairConfigDtoBuilder b)]) = _$CreateOrderbookPairConfigDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateOrderbookPairConfigDtoBuilder b) => b
      ..enabled = true
      ..priority = 100;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateOrderbookPairConfigDto> get serializer => _$CreateOrderbookPairConfigDtoSerializer();
}

class _$CreateOrderbookPairConfigDtoSerializer implements PrimitiveSerializer<CreateOrderbookPairConfigDto> {
  @override
  final Iterable<Type> types = const [CreateOrderbookPairConfigDto, _$CreateOrderbookPairConfigDto];

  @override
  final String wireName = r'CreateOrderbookPairConfigDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateOrderbookPairConfigDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
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
      specifiedType: const FullType(CreateOrderbookPairConfigDtoVenueTypeEnum),
    );
    yield r'instrumentType';
    yield serializers.serialize(
      object.instrumentType,
      specifiedType: const FullType(CreateOrderbookPairConfigDtoInstrumentTypeEnum),
    );
    if (object.enabled != null) {
      yield r'enabled';
      yield serializers.serialize(
        object.enabled,
        specifiedType: const FullType(bool),
      );
    }
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
    if (object.priority != null) {
      yield r'priority';
      yield serializers.serialize(
        object.priority,
        specifiedType: const FullType(num),
      );
    }
    if (object.metadata != null) {
      yield r'metadata';
      yield serializers.serialize(
        object.metadata,
        specifiedType: const FullType(JsonObject),
      );
    }
    if (object.description != null) {
      yield r'description';
      yield serializers.serialize(
        object.description,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateOrderbookPairConfigDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateOrderbookPairConfigDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
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
            specifiedType: const FullType(CreateOrderbookPairConfigDtoVenueTypeEnum),
          ) as CreateOrderbookPairConfigDtoVenueTypeEnum;
          result.venueType = valueDes;
          break;
        case r'instrumentType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(CreateOrderbookPairConfigDtoInstrumentTypeEnum),
          ) as CreateOrderbookPairConfigDtoInstrumentTypeEnum;
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
            specifiedType: const FullType(JsonObject),
          ) as JsonObject;
          result.metadata = valueDes;
          break;
        case r'description':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.description = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateOrderbookPairConfigDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateOrderbookPairConfigDtoBuilder();
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

class CreateOrderbookPairConfigDtoVenueTypeEnum extends EnumClass {

  /// 交易场所类型
  @BuiltValueEnumConst(wireName: r'CEX')
  static const CreateOrderbookPairConfigDtoVenueTypeEnum CEX = _$createOrderbookPairConfigDtoVenueTypeEnum_CEX;
  /// 交易场所类型
  @BuiltValueEnumConst(wireName: r'DEX')
  static const CreateOrderbookPairConfigDtoVenueTypeEnum DEX = _$createOrderbookPairConfigDtoVenueTypeEnum_DEX;

  static Serializer<CreateOrderbookPairConfigDtoVenueTypeEnum> get serializer => _$createOrderbookPairConfigDtoVenueTypeEnumSerializer;

  const CreateOrderbookPairConfigDtoVenueTypeEnum._(String name): super(name);

  static BuiltSet<CreateOrderbookPairConfigDtoVenueTypeEnum> get values => _$createOrderbookPairConfigDtoVenueTypeEnumValues;
  static CreateOrderbookPairConfigDtoVenueTypeEnum valueOf(String name) => _$createOrderbookPairConfigDtoVenueTypeEnumValueOf(name);
}

class CreateOrderbookPairConfigDtoInstrumentTypeEnum extends EnumClass {

  /// 交易品种类型
  @BuiltValueEnumConst(wireName: r'SPOT')
  static const CreateOrderbookPairConfigDtoInstrumentTypeEnum SPOT = _$createOrderbookPairConfigDtoInstrumentTypeEnum_SPOT;
  /// 交易品种类型
  @BuiltValueEnumConst(wireName: r'PERPETUAL')
  static const CreateOrderbookPairConfigDtoInstrumentTypeEnum PERPETUAL = _$createOrderbookPairConfigDtoInstrumentTypeEnum_PERPETUAL;
  /// 交易品种类型
  @BuiltValueEnumConst(wireName: r'FUTURE')
  static const CreateOrderbookPairConfigDtoInstrumentTypeEnum FUTURE = _$createOrderbookPairConfigDtoInstrumentTypeEnum_FUTURE;

  static Serializer<CreateOrderbookPairConfigDtoInstrumentTypeEnum> get serializer => _$createOrderbookPairConfigDtoInstrumentTypeEnumSerializer;

  const CreateOrderbookPairConfigDtoInstrumentTypeEnum._(String name): super(name);

  static BuiltSet<CreateOrderbookPairConfigDtoInstrumentTypeEnum> get values => _$createOrderbookPairConfigDtoInstrumentTypeEnumValues;
  static CreateOrderbookPairConfigDtoInstrumentTypeEnum valueOf(String name) => _$createOrderbookPairConfigDtoInstrumentTypeEnumValueOf(name);
}

