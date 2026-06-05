//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'trades_pair_config_response_dto.g.dart';

/// TradesPairConfigResponseDto
///
/// Properties:
/// * [id] - 配置ID
/// * [pairId] - 交易对唯一标识
/// * [exchange] - 交易所标识
/// * [symbol] - 交易对符号
/// * [baseAsset] - 基础资产
/// * [quoteAsset] - 计价资产
/// * [instrumentType] - 交易品种类型
/// * [canonicalInstId] - 标准化 OKX instId（用于订阅/查询一致性）
/// * [enabled] - 是否启用订阅
/// * [priority] - 优先级
/// * [metadata] - 扩展配置
/// * [description] - 备注说明
/// * [createdAt] - 创建时间
/// * [updatedAt] - 更新时间
@BuiltValue()
abstract class TradesPairConfigResponseDto implements Built<TradesPairConfigResponseDto, TradesPairConfigResponseDtoBuilder> {
  /// 配置ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 交易对唯一标识
  @BuiltValueField(wireName: r'pairId')
  String get pairId;

  /// 交易所标识
  @BuiltValueField(wireName: r'exchange')
  String get exchange;

  /// 交易对符号
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 基础资产
  @BuiltValueField(wireName: r'baseAsset')
  String get baseAsset;

  /// 计价资产
  @BuiltValueField(wireName: r'quoteAsset')
  String get quoteAsset;

  /// 交易品种类型
  @BuiltValueField(wireName: r'instrumentType')
  TradesPairConfigResponseDtoInstrumentTypeEnum get instrumentType;
  // enum instrumentTypeEnum {  SPOT,  PERPETUAL,  FUTURE,  };

  /// 标准化 OKX instId（用于订阅/查询一致性）
  @BuiltValueField(wireName: r'canonicalInstId')
  String? get canonicalInstId;

  /// 是否启用订阅
  @BuiltValueField(wireName: r'enabled')
  bool get enabled;

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
  String get createdAt;

  /// 更新时间
  @BuiltValueField(wireName: r'updatedAt')
  String get updatedAt;

  TradesPairConfigResponseDto._();

  factory TradesPairConfigResponseDto([void updates(TradesPairConfigResponseDtoBuilder b)]) = _$TradesPairConfigResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TradesPairConfigResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TradesPairConfigResponseDto> get serializer => _$TradesPairConfigResponseDtoSerializer();
}

class _$TradesPairConfigResponseDtoSerializer implements PrimitiveSerializer<TradesPairConfigResponseDto> {
  @override
  final Iterable<Type> types = const [TradesPairConfigResponseDto, _$TradesPairConfigResponseDto];

  @override
  final String wireName = r'TradesPairConfigResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TradesPairConfigResponseDto object, {
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
      specifiedType: const FullType(TradesPairConfigResponseDtoInstrumentTypeEnum),
    );
    if (object.canonicalInstId != null) {
      yield r'canonicalInstId';
      yield serializers.serialize(
        object.canonicalInstId,
        specifiedType: const FullType.nullable(String),
      );
    }
    yield r'enabled';
    yield serializers.serialize(
      object.enabled,
      specifiedType: const FullType(bool),
    );
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
    TradesPairConfigResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TradesPairConfigResponseDtoBuilder result,
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
            specifiedType: const FullType(TradesPairConfigResponseDtoInstrumentTypeEnum),
          ) as TradesPairConfigResponseDtoInstrumentTypeEnum;
          result.instrumentType = valueDes;
          break;
        case r'canonicalInstId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.canonicalInstId = valueDes;
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
  TradesPairConfigResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TradesPairConfigResponseDtoBuilder();
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

class TradesPairConfigResponseDtoInstrumentTypeEnum extends EnumClass {

  /// 交易品种类型
  @BuiltValueEnumConst(wireName: r'SPOT')
  static const TradesPairConfigResponseDtoInstrumentTypeEnum SPOT = _$tradesPairConfigResponseDtoInstrumentTypeEnum_SPOT;
  /// 交易品种类型
  @BuiltValueEnumConst(wireName: r'PERPETUAL')
  static const TradesPairConfigResponseDtoInstrumentTypeEnum PERPETUAL = _$tradesPairConfigResponseDtoInstrumentTypeEnum_PERPETUAL;
  /// 交易品种类型
  @BuiltValueEnumConst(wireName: r'FUTURE')
  static const TradesPairConfigResponseDtoInstrumentTypeEnum FUTURE = _$tradesPairConfigResponseDtoInstrumentTypeEnum_FUTURE;

  static Serializer<TradesPairConfigResponseDtoInstrumentTypeEnum> get serializer => _$tradesPairConfigResponseDtoInstrumentTypeEnumSerializer;

  const TradesPairConfigResponseDtoInstrumentTypeEnum._(String name): super(name);

  static BuiltSet<TradesPairConfigResponseDtoInstrumentTypeEnum> get values => _$tradesPairConfigResponseDtoInstrumentTypeEnumValues;
  static TradesPairConfigResponseDtoInstrumentTypeEnum valueOf(String name) => _$tradesPairConfigResponseDtoInstrumentTypeEnumValueOf(name);
}

