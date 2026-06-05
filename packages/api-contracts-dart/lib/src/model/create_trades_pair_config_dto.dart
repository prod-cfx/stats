//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_trades_pair_config_dto.g.dart';

/// CreateTradesPairConfigDto
///
/// Properties:
/// * [pairId] - 交易对唯一标识，格式: SYMBOL.EXCHANGE.INSTRUMENT_TYPE（全大写），例如 BTC-USDT.OKX.SPOT 或 BTCUSD_PERP.BINANCE.PERPETUAL
/// * [exchange] - 交易所标识，目前支持 OKX、BINANCE
/// * [symbol] - 交易对符号，例如 BTC-USDT, BTC-USDT-SWAP
/// * [baseAsset] - 基础资产，例如 BTC
/// * [quoteAsset] - 计价资产，例如 USDT
/// * [instrumentType] - 交易品种类型
/// * [enabled] - 是否启用订阅
/// * [priority] - 优先级（数字越小优先级越高）
/// * [metadata] - 扩展配置（JSON格式），例如存储交易所特定参数。最大深度5层，最大10KB
/// * [description] - 备注说明
@BuiltValue()
abstract class CreateTradesPairConfigDto implements Built<CreateTradesPairConfigDto, CreateTradesPairConfigDtoBuilder> {
  /// 交易对唯一标识，格式: SYMBOL.EXCHANGE.INSTRUMENT_TYPE（全大写），例如 BTC-USDT.OKX.SPOT 或 BTCUSD_PERP.BINANCE.PERPETUAL
  @BuiltValueField(wireName: r'pairId')
  String get pairId;

  /// 交易所标识，目前支持 OKX、BINANCE
  @BuiltValueField(wireName: r'exchange')
  String get exchange;

  /// 交易对符号，例如 BTC-USDT, BTC-USDT-SWAP
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 基础资产，例如 BTC
  @BuiltValueField(wireName: r'baseAsset')
  String get baseAsset;

  /// 计价资产，例如 USDT
  @BuiltValueField(wireName: r'quoteAsset')
  String get quoteAsset;

  /// 交易品种类型
  @BuiltValueField(wireName: r'instrumentType')
  CreateTradesPairConfigDtoInstrumentTypeEnum get instrumentType;
  // enum instrumentTypeEnum {  SPOT,  PERPETUAL,  FUTURE,  };

  /// 是否启用订阅
  @BuiltValueField(wireName: r'enabled')
  bool? get enabled;

  /// 优先级（数字越小优先级越高）
  @BuiltValueField(wireName: r'priority')
  num? get priority;

  /// 扩展配置（JSON格式），例如存储交易所特定参数。最大深度5层，最大10KB
  @BuiltValueField(wireName: r'metadata')
  JsonObject? get metadata;

  /// 备注说明
  @BuiltValueField(wireName: r'description')
  String? get description;

  CreateTradesPairConfigDto._();

  factory CreateTradesPairConfigDto([void updates(CreateTradesPairConfigDtoBuilder b)]) = _$CreateTradesPairConfigDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateTradesPairConfigDtoBuilder b) => b
      ..enabled = true
      ..priority = 100;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateTradesPairConfigDto> get serializer => _$CreateTradesPairConfigDtoSerializer();
}

class _$CreateTradesPairConfigDtoSerializer implements PrimitiveSerializer<CreateTradesPairConfigDto> {
  @override
  final Iterable<Type> types = const [CreateTradesPairConfigDto, _$CreateTradesPairConfigDto];

  @override
  final String wireName = r'CreateTradesPairConfigDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateTradesPairConfigDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'pairId';
    yield serializers.serialize(
      object.pairId,
      specifiedType: const FullType(String),
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
    yield r'instrumentType';
    yield serializers.serialize(
      object.instrumentType,
      specifiedType: const FullType(CreateTradesPairConfigDtoInstrumentTypeEnum),
    );
    if (object.enabled != null) {
      yield r'enabled';
      yield serializers.serialize(
        object.enabled,
        specifiedType: const FullType(bool),
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
    CreateTradesPairConfigDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateTradesPairConfigDtoBuilder result,
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
        case r'instrumentType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(CreateTradesPairConfigDtoInstrumentTypeEnum),
          ) as CreateTradesPairConfigDtoInstrumentTypeEnum;
          result.instrumentType = valueDes;
          break;
        case r'enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.enabled = valueDes;
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
  CreateTradesPairConfigDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateTradesPairConfigDtoBuilder();
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

class CreateTradesPairConfigDtoInstrumentTypeEnum extends EnumClass {

  /// 交易品种类型
  @BuiltValueEnumConst(wireName: r'SPOT')
  static const CreateTradesPairConfigDtoInstrumentTypeEnum SPOT = _$createTradesPairConfigDtoInstrumentTypeEnum_SPOT;
  /// 交易品种类型
  @BuiltValueEnumConst(wireName: r'PERPETUAL')
  static const CreateTradesPairConfigDtoInstrumentTypeEnum PERPETUAL = _$createTradesPairConfigDtoInstrumentTypeEnum_PERPETUAL;
  /// 交易品种类型
  @BuiltValueEnumConst(wireName: r'FUTURE')
  static const CreateTradesPairConfigDtoInstrumentTypeEnum FUTURE = _$createTradesPairConfigDtoInstrumentTypeEnum_FUTURE;

  static Serializer<CreateTradesPairConfigDtoInstrumentTypeEnum> get serializer => _$createTradesPairConfigDtoInstrumentTypeEnumSerializer;

  const CreateTradesPairConfigDtoInstrumentTypeEnum._(String name): super(name);

  static BuiltSet<CreateTradesPairConfigDtoInstrumentTypeEnum> get values => _$createTradesPairConfigDtoInstrumentTypeEnumValues;
  static CreateTradesPairConfigDtoInstrumentTypeEnum valueOf(String name) => _$createTradesPairConfigDtoInstrumentTypeEnumValueOf(name);
}

