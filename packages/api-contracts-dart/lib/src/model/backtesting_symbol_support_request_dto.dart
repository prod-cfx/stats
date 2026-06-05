//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_symbol_support_request_dto.g.dart';

/// BacktestingSymbolSupportRequestDto
///
/// Properties:
/// * [exchange] 
/// * [marketType] 
/// * [symbol] 
/// * [baseTimeframe] 
@BuiltValue()
abstract class BacktestingSymbolSupportRequestDto implements Built<BacktestingSymbolSupportRequestDto, BacktestingSymbolSupportRequestDtoBuilder> {
  @BuiltValueField(wireName: r'exchange')
  BacktestingSymbolSupportRequestDtoExchangeEnum get exchange;
  // enum exchangeEnum {  binance,  okx,  hyperliquid,  };

  @BuiltValueField(wireName: r'marketType')
  BacktestingSymbolSupportRequestDtoMarketTypeEnum get marketType;
  // enum marketTypeEnum {  spot,  perp,  };

  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  @BuiltValueField(wireName: r'baseTimeframe')
  BacktestingSymbolSupportRequestDtoBaseTimeframeEnum get baseTimeframe;
  // enum baseTimeframeEnum {  1m,  3m,  5m,  15m,  30m,  1h,  4h,  6h,  8h,  12h,  1d,  1w,  };

  BacktestingSymbolSupportRequestDto._();

  factory BacktestingSymbolSupportRequestDto([void updates(BacktestingSymbolSupportRequestDtoBuilder b)]) = _$BacktestingSymbolSupportRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingSymbolSupportRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingSymbolSupportRequestDto> get serializer => _$BacktestingSymbolSupportRequestDtoSerializer();
}

class _$BacktestingSymbolSupportRequestDtoSerializer implements PrimitiveSerializer<BacktestingSymbolSupportRequestDto> {
  @override
  final Iterable<Type> types = const [BacktestingSymbolSupportRequestDto, _$BacktestingSymbolSupportRequestDto];

  @override
  final String wireName = r'BacktestingSymbolSupportRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingSymbolSupportRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'exchange';
    yield serializers.serialize(
      object.exchange,
      specifiedType: const FullType(BacktestingSymbolSupportRequestDtoExchangeEnum),
    );
    yield r'marketType';
    yield serializers.serialize(
      object.marketType,
      specifiedType: const FullType(BacktestingSymbolSupportRequestDtoMarketTypeEnum),
    );
    yield r'symbol';
    yield serializers.serialize(
      object.symbol,
      specifiedType: const FullType(String),
    );
    yield r'baseTimeframe';
    yield serializers.serialize(
      object.baseTimeframe,
      specifiedType: const FullType(BacktestingSymbolSupportRequestDtoBaseTimeframeEnum),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingSymbolSupportRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingSymbolSupportRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'exchange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingSymbolSupportRequestDtoExchangeEnum),
          ) as BacktestingSymbolSupportRequestDtoExchangeEnum;
          result.exchange = valueDes;
          break;
        case r'marketType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingSymbolSupportRequestDtoMarketTypeEnum),
          ) as BacktestingSymbolSupportRequestDtoMarketTypeEnum;
          result.marketType = valueDes;
          break;
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbol = valueDes;
          break;
        case r'baseTimeframe':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingSymbolSupportRequestDtoBaseTimeframeEnum),
          ) as BacktestingSymbolSupportRequestDtoBaseTimeframeEnum;
          result.baseTimeframe = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingSymbolSupportRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingSymbolSupportRequestDtoBuilder();
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

class BacktestingSymbolSupportRequestDtoExchangeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'binance')
  static const BacktestingSymbolSupportRequestDtoExchangeEnum binance = _$backtestingSymbolSupportRequestDtoExchangeEnum_binance;
  @BuiltValueEnumConst(wireName: r'okx')
  static const BacktestingSymbolSupportRequestDtoExchangeEnum okx = _$backtestingSymbolSupportRequestDtoExchangeEnum_okx;
  @BuiltValueEnumConst(wireName: r'hyperliquid')
  static const BacktestingSymbolSupportRequestDtoExchangeEnum hyperliquid = _$backtestingSymbolSupportRequestDtoExchangeEnum_hyperliquid;

  static Serializer<BacktestingSymbolSupportRequestDtoExchangeEnum> get serializer => _$backtestingSymbolSupportRequestDtoExchangeEnumSerializer;

  const BacktestingSymbolSupportRequestDtoExchangeEnum._(String name): super(name);

  static BuiltSet<BacktestingSymbolSupportRequestDtoExchangeEnum> get values => _$backtestingSymbolSupportRequestDtoExchangeEnumValues;
  static BacktestingSymbolSupportRequestDtoExchangeEnum valueOf(String name) => _$backtestingSymbolSupportRequestDtoExchangeEnumValueOf(name);
}

class BacktestingSymbolSupportRequestDtoMarketTypeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'spot')
  static const BacktestingSymbolSupportRequestDtoMarketTypeEnum spot = _$backtestingSymbolSupportRequestDtoMarketTypeEnum_spot;
  @BuiltValueEnumConst(wireName: r'perp')
  static const BacktestingSymbolSupportRequestDtoMarketTypeEnum perp = _$backtestingSymbolSupportRequestDtoMarketTypeEnum_perp;

  static Serializer<BacktestingSymbolSupportRequestDtoMarketTypeEnum> get serializer => _$backtestingSymbolSupportRequestDtoMarketTypeEnumSerializer;

  const BacktestingSymbolSupportRequestDtoMarketTypeEnum._(String name): super(name);

  static BuiltSet<BacktestingSymbolSupportRequestDtoMarketTypeEnum> get values => _$backtestingSymbolSupportRequestDtoMarketTypeEnumValues;
  static BacktestingSymbolSupportRequestDtoMarketTypeEnum valueOf(String name) => _$backtestingSymbolSupportRequestDtoMarketTypeEnumValueOf(name);
}

class BacktestingSymbolSupportRequestDtoBaseTimeframeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'1m')
  static const BacktestingSymbolSupportRequestDtoBaseTimeframeEnum n1m = _$backtestingSymbolSupportRequestDtoBaseTimeframeEnum_n1m;
  @BuiltValueEnumConst(wireName: r'3m')
  static const BacktestingSymbolSupportRequestDtoBaseTimeframeEnum n3m = _$backtestingSymbolSupportRequestDtoBaseTimeframeEnum_n3m;
  @BuiltValueEnumConst(wireName: r'5m')
  static const BacktestingSymbolSupportRequestDtoBaseTimeframeEnum n5m = _$backtestingSymbolSupportRequestDtoBaseTimeframeEnum_n5m;
  @BuiltValueEnumConst(wireName: r'15m')
  static const BacktestingSymbolSupportRequestDtoBaseTimeframeEnum n15m = _$backtestingSymbolSupportRequestDtoBaseTimeframeEnum_n15m;
  @BuiltValueEnumConst(wireName: r'30m')
  static const BacktestingSymbolSupportRequestDtoBaseTimeframeEnum n30m = _$backtestingSymbolSupportRequestDtoBaseTimeframeEnum_n30m;
  @BuiltValueEnumConst(wireName: r'1h')
  static const BacktestingSymbolSupportRequestDtoBaseTimeframeEnum n1h = _$backtestingSymbolSupportRequestDtoBaseTimeframeEnum_n1h;
  @BuiltValueEnumConst(wireName: r'4h')
  static const BacktestingSymbolSupportRequestDtoBaseTimeframeEnum n4h = _$backtestingSymbolSupportRequestDtoBaseTimeframeEnum_n4h;
  @BuiltValueEnumConst(wireName: r'6h')
  static const BacktestingSymbolSupportRequestDtoBaseTimeframeEnum n6h = _$backtestingSymbolSupportRequestDtoBaseTimeframeEnum_n6h;
  @BuiltValueEnumConst(wireName: r'8h')
  static const BacktestingSymbolSupportRequestDtoBaseTimeframeEnum n8h = _$backtestingSymbolSupportRequestDtoBaseTimeframeEnum_n8h;
  @BuiltValueEnumConst(wireName: r'12h')
  static const BacktestingSymbolSupportRequestDtoBaseTimeframeEnum n12h = _$backtestingSymbolSupportRequestDtoBaseTimeframeEnum_n12h;
  @BuiltValueEnumConst(wireName: r'1d')
  static const BacktestingSymbolSupportRequestDtoBaseTimeframeEnum n1d = _$backtestingSymbolSupportRequestDtoBaseTimeframeEnum_n1d;
  @BuiltValueEnumConst(wireName: r'1w')
  static const BacktestingSymbolSupportRequestDtoBaseTimeframeEnum n1w = _$backtestingSymbolSupportRequestDtoBaseTimeframeEnum_n1w;

  static Serializer<BacktestingSymbolSupportRequestDtoBaseTimeframeEnum> get serializer => _$backtestingSymbolSupportRequestDtoBaseTimeframeEnumSerializer;

  const BacktestingSymbolSupportRequestDtoBaseTimeframeEnum._(String name): super(name);

  static BuiltSet<BacktestingSymbolSupportRequestDtoBaseTimeframeEnum> get values => _$backtestingSymbolSupportRequestDtoBaseTimeframeEnumValues;
  static BacktestingSymbolSupportRequestDtoBaseTimeframeEnum valueOf(String name) => _$backtestingSymbolSupportRequestDtoBaseTimeframeEnumValueOf(name);
}

