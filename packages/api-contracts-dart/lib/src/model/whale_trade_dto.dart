//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_trade_dto.g.dart';

/// WhaleTradeDto
///
/// Properties:
/// * [userAddress] - 鲸鱼地址
/// * [symbol] - 币种符号
/// * [side] - 交易方向
/// * [tradeSize] - 交易数量（绝对值）
/// * [price] - 交易价格（USD）
/// * [tradeValueUsd] - 交易价值（USD）
/// * [tradeTime] - 交易时间
@BuiltValue()
abstract class WhaleTradeDto implements Built<WhaleTradeDto, WhaleTradeDtoBuilder> {
  /// 鲸鱼地址
  @BuiltValueField(wireName: r'user_address')
  String get userAddress;

  /// 币种符号
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 交易方向
  @BuiltValueField(wireName: r'side')
  WhaleTradeDtoSideEnum get side;
  // enum sideEnum {  Long,  Short,  };

  /// 交易数量（绝对值）
  @BuiltValueField(wireName: r'trade_size')
  num get tradeSize;

  /// 交易价格（USD）
  @BuiltValueField(wireName: r'price')
  num get price;

  /// 交易价值（USD）
  @BuiltValueField(wireName: r'trade_value_usd')
  num get tradeValueUsd;

  /// 交易时间
  @BuiltValueField(wireName: r'trade_time')
  String get tradeTime;

  WhaleTradeDto._();

  factory WhaleTradeDto([void updates(WhaleTradeDtoBuilder b)]) = _$WhaleTradeDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleTradeDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleTradeDto> get serializer => _$WhaleTradeDtoSerializer();
}

class _$WhaleTradeDtoSerializer implements PrimitiveSerializer<WhaleTradeDto> {
  @override
  final Iterable<Type> types = const [WhaleTradeDto, _$WhaleTradeDto];

  @override
  final String wireName = r'WhaleTradeDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleTradeDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'user_address';
    yield serializers.serialize(
      object.userAddress,
      specifiedType: const FullType(String),
    );
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'side';
    yield serializers.serialize(
      object.side,
      specifiedType: const FullType(WhaleTradeDtoSideEnum),
    );
    yield r'trade_size';
    yield serializers.serialize(
      object.tradeSize,
      specifiedType: const FullType(num),
    );
    yield r'price';
    yield serializers.serialize(
      object.price,
      specifiedType: const FullType(num),
    );
    yield r'trade_value_usd';
    yield serializers.serialize(
      object.tradeValueUsd,
      specifiedType: const FullType(num),
    );
    yield r'trade_time';
    yield serializers.serialize(
      object.tradeTime,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleTradeDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleTradeDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'user_address':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.userAddress = valueDes;
          break;
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbol = valueDes;
          break;
        case r'side':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleTradeDtoSideEnum),
          ) as WhaleTradeDtoSideEnum;
          result.side = valueDes;
          break;
        case r'trade_size':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.tradeSize = valueDes;
          break;
        case r'price':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.price = valueDes;
          break;
        case r'trade_value_usd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.tradeValueUsd = valueDes;
          break;
        case r'trade_time':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.tradeTime = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleTradeDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleTradeDtoBuilder();
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

class WhaleTradeDtoSideEnum extends EnumClass {

  /// 交易方向
  @BuiltValueEnumConst(wireName: r'Long')
  static const WhaleTradeDtoSideEnum long = _$whaleTradeDtoSideEnum_long;
  /// 交易方向
  @BuiltValueEnumConst(wireName: r'Short')
  static const WhaleTradeDtoSideEnum short = _$whaleTradeDtoSideEnum_short;

  static Serializer<WhaleTradeDtoSideEnum> get serializer => _$whaleTradeDtoSideEnumSerializer;

  const WhaleTradeDtoSideEnum._(String name): super(name);

  static BuiltSet<WhaleTradeDtoSideEnum> get values => _$whaleTradeDtoSideEnumValues;
  static WhaleTradeDtoSideEnum valueOf(String name) => _$whaleTradeDtoSideEnumValueOf(name);
}

