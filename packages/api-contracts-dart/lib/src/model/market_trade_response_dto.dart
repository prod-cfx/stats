//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'market_trade_response_dto.g.dart';

/// MarketTradeResponseDto
///
/// Properties:
/// * [id] - 交易记录ID
/// * [exchange] - 交易所代码
/// * [instrumentType] - 合约类型
/// * [symbol] - 交易对符号
/// * [baseAsset] - 基础资产
/// * [quoteAsset] - 计价资产
/// * [tradeId] - 交易ID（交易所提供）
/// * [price] - 交易价格
/// * [size] - 交易数量
/// * [side] - 交易方向
/// * [tradeTimestamp] - 交易时间戳（毫秒）
/// * [createdAt] - 创建时间
@BuiltValue()
abstract class MarketTradeResponseDto implements Built<MarketTradeResponseDto, MarketTradeResponseDtoBuilder> {
  /// 交易记录ID
  @BuiltValueField(wireName: r'id')
  num get id;

  /// 交易所代码
  @BuiltValueField(wireName: r'exchange')
  String get exchange;

  /// 合约类型
  @BuiltValueField(wireName: r'instrumentType')
  MarketTradeResponseDtoInstrumentTypeEnum get instrumentType;
  // enum instrumentTypeEnum {  SPOT,  PERPETUAL,  FUTURE,  };

  /// 交易对符号
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 基础资产
  @BuiltValueField(wireName: r'baseAsset')
  String get baseAsset;

  /// 计价资产
  @BuiltValueField(wireName: r'quoteAsset')
  String get quoteAsset;

  /// 交易ID（交易所提供）
  @BuiltValueField(wireName: r'tradeId')
  String get tradeId;

  /// 交易价格
  @BuiltValueField(wireName: r'price')
  String get price;

  /// 交易数量
  @BuiltValueField(wireName: r'size')
  String get size;

  /// 交易方向
  @BuiltValueField(wireName: r'side')
  MarketTradeResponseDtoSideEnum get side;
  // enum sideEnum {  buy,  sell,  };

  /// 交易时间戳（毫秒）
  @BuiltValueField(wireName: r'tradeTimestamp')
  String get tradeTimestamp;

  /// 创建时间
  @BuiltValueField(wireName: r'createdAt')
  String get createdAt;

  MarketTradeResponseDto._();

  factory MarketTradeResponseDto([void updates(MarketTradeResponseDtoBuilder b)]) = _$MarketTradeResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(MarketTradeResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<MarketTradeResponseDto> get serializer => _$MarketTradeResponseDtoSerializer();
}

class _$MarketTradeResponseDtoSerializer implements PrimitiveSerializer<MarketTradeResponseDto> {
  @override
  final Iterable<Type> types = const [MarketTradeResponseDto, _$MarketTradeResponseDto];

  @override
  final String wireName = r'MarketTradeResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    MarketTradeResponseDto object, {
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
    yield r'instrumentType';
    yield serializers.serialize(
      object.instrumentType,
      specifiedType: const FullType(MarketTradeResponseDtoInstrumentTypeEnum),
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
    yield r'tradeId';
    yield serializers.serialize(
      object.tradeId,
      specifiedType: const FullType(String),
    );
    yield r'price';
    yield serializers.serialize(
      object.price,
      specifiedType: const FullType(String),
    );
    yield r'size';
    yield serializers.serialize(
      object.size,
      specifiedType: const FullType(String),
    );
    yield r'side';
    yield serializers.serialize(
      object.side,
      specifiedType: const FullType(MarketTradeResponseDtoSideEnum),
    );
    yield r'tradeTimestamp';
    yield serializers.serialize(
      object.tradeTimestamp,
      specifiedType: const FullType(String),
    );
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    MarketTradeResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required MarketTradeResponseDtoBuilder result,
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
        case r'instrumentType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(MarketTradeResponseDtoInstrumentTypeEnum),
          ) as MarketTradeResponseDtoInstrumentTypeEnum;
          result.instrumentType = valueDes;
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
        case r'tradeId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.tradeId = valueDes;
          break;
        case r'price':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.price = valueDes;
          break;
        case r'size':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.size = valueDes;
          break;
        case r'side':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(MarketTradeResponseDtoSideEnum),
          ) as MarketTradeResponseDtoSideEnum;
          result.side = valueDes;
          break;
        case r'tradeTimestamp':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.tradeTimestamp = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.createdAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  MarketTradeResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = MarketTradeResponseDtoBuilder();
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

class MarketTradeResponseDtoInstrumentTypeEnum extends EnumClass {

  /// 合约类型
  @BuiltValueEnumConst(wireName: r'SPOT')
  static const MarketTradeResponseDtoInstrumentTypeEnum SPOT = _$marketTradeResponseDtoInstrumentTypeEnum_SPOT;
  /// 合约类型
  @BuiltValueEnumConst(wireName: r'PERPETUAL')
  static const MarketTradeResponseDtoInstrumentTypeEnum PERPETUAL = _$marketTradeResponseDtoInstrumentTypeEnum_PERPETUAL;
  /// 合约类型
  @BuiltValueEnumConst(wireName: r'FUTURE')
  static const MarketTradeResponseDtoInstrumentTypeEnum FUTURE = _$marketTradeResponseDtoInstrumentTypeEnum_FUTURE;

  static Serializer<MarketTradeResponseDtoInstrumentTypeEnum> get serializer => _$marketTradeResponseDtoInstrumentTypeEnumSerializer;

  const MarketTradeResponseDtoInstrumentTypeEnum._(String name): super(name);

  static BuiltSet<MarketTradeResponseDtoInstrumentTypeEnum> get values => _$marketTradeResponseDtoInstrumentTypeEnumValues;
  static MarketTradeResponseDtoInstrumentTypeEnum valueOf(String name) => _$marketTradeResponseDtoInstrumentTypeEnumValueOf(name);
}

class MarketTradeResponseDtoSideEnum extends EnumClass {

  /// 交易方向
  @BuiltValueEnumConst(wireName: r'buy')
  static const MarketTradeResponseDtoSideEnum buy = _$marketTradeResponseDtoSideEnum_buy;
  /// 交易方向
  @BuiltValueEnumConst(wireName: r'sell')
  static const MarketTradeResponseDtoSideEnum sell = _$marketTradeResponseDtoSideEnum_sell;

  static Serializer<MarketTradeResponseDtoSideEnum> get serializer => _$marketTradeResponseDtoSideEnumSerializer;

  const MarketTradeResponseDtoSideEnum._(String name): super(name);

  static BuiltSet<MarketTradeResponseDtoSideEnum> get values => _$marketTradeResponseDtoSideEnumValues;
  static MarketTradeResponseDtoSideEnum valueOf(String name) => _$marketTradeResponseDtoSideEnumValueOf(name);
}

