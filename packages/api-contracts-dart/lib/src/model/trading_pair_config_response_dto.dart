//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'trading_pair_config_response_dto.g.dart';

/// TradingPairConfigResponseDto
///
/// Properties:
/// * [id] - 交易对唯一 ID，例如 BTCUSDT.BINANCE.SPOT
/// * [displaySymbol] - 展示用符号，例如 BTC/USDT
/// * [symbol] - 内部 symbol，例如 BTCUSDT 或 BTC-USDT
/// * [baseAsset] - 基础资产，例如 BTC
/// * [quoteAsset] - 计价资产，例如 USDT
/// * [venueType] - 交易 venue 类型（DEX / CEX）
/// * [instrumentType] - 交易品种类型（现货 / 永续 / 期货）
/// * [pricePrecision] - 价格精度
/// * [quantityPrecision] - 数量精度
/// * [minNotional] - 最小名义价值（quote 金额）
/// * [minQuantity] - 最小下单数量（base 数量）
/// * [enabled] - 是否启用该交易对
/// * [exchange] - 交易所标识，仅对 CEX 生效
/// * [exchangeSymbol] - 交易所原始 symbol，仅对 CEX 生效
/// * [maxLeverage] - 最大杠杆倍数，仅对合约 CEX 生效
/// * [contractSize] - 合约面值，仅对合约 CEX 生效
/// * [chainId] - 链 ID，仅对 DEX 生效
/// * [baseTokenAddress] - 基础资产合约地址，仅对 DEX 生效
/// * [quoteTokenAddress] - 计价资产合约地址，仅对 DEX 生效
/// * [routerAddress] - 路由合约地址，仅对 DEX 生效
/// * [poolAddress] - 池子合约地址，仅对 DEX 生效
/// * [dexName] - DEX 名称，例如 UNISWAP_V3，仅对 DEX 生效
@BuiltValue()
abstract class TradingPairConfigResponseDto implements Built<TradingPairConfigResponseDto, TradingPairConfigResponseDtoBuilder> {
  /// 交易对唯一 ID，例如 BTCUSDT.BINANCE.SPOT
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 展示用符号，例如 BTC/USDT
  @BuiltValueField(wireName: r'displaySymbol')
  String get displaySymbol;

  /// 内部 symbol，例如 BTCUSDT 或 BTC-USDT
  @BuiltValueField(wireName: r'symbol')
  String get symbol;

  /// 基础资产，例如 BTC
  @BuiltValueField(wireName: r'baseAsset')
  String get baseAsset;

  /// 计价资产，例如 USDT
  @BuiltValueField(wireName: r'quoteAsset')
  String get quoteAsset;

  /// 交易 venue 类型（DEX / CEX）
  @BuiltValueField(wireName: r'venueType')
  TradingPairConfigResponseDtoVenueTypeEnum get venueType;
  // enum venueTypeEnum {  DEX,  CEX,  };

  /// 交易品种类型（现货 / 永续 / 期货）
  @BuiltValueField(wireName: r'instrumentType')
  TradingPairConfigResponseDtoInstrumentTypeEnum get instrumentType;
  // enum instrumentTypeEnum {  SPOT,  PERPETUAL,  FUTURE,  };

  /// 价格精度
  @BuiltValueField(wireName: r'pricePrecision')
  num get pricePrecision;

  /// 数量精度
  @BuiltValueField(wireName: r'quantityPrecision')
  num get quantityPrecision;

  /// 最小名义价值（quote 金额）
  @BuiltValueField(wireName: r'minNotional')
  num? get minNotional;

  /// 最小下单数量（base 数量）
  @BuiltValueField(wireName: r'minQuantity')
  num? get minQuantity;

  /// 是否启用该交易对
  @BuiltValueField(wireName: r'enabled')
  bool get enabled;

  /// 交易所标识，仅对 CEX 生效
  @BuiltValueField(wireName: r'exchange')
  TradingPairConfigResponseDtoExchangeEnum? get exchange;
  // enum exchangeEnum {  BINANCE,  OKX,  BYBIT,  };

  /// 交易所原始 symbol，仅对 CEX 生效
  @BuiltValueField(wireName: r'exchangeSymbol')
  String? get exchangeSymbol;

  /// 最大杠杆倍数，仅对合约 CEX 生效
  @BuiltValueField(wireName: r'maxLeverage')
  num? get maxLeverage;

  /// 合约面值，仅对合约 CEX 生效
  @BuiltValueField(wireName: r'contractSize')
  num? get contractSize;

  /// 链 ID，仅对 DEX 生效
  @BuiltValueField(wireName: r'chainId')
  num? get chainId;

  /// 基础资产合约地址，仅对 DEX 生效
  @BuiltValueField(wireName: r'baseTokenAddress')
  String? get baseTokenAddress;

  /// 计价资产合约地址，仅对 DEX 生效
  @BuiltValueField(wireName: r'quoteTokenAddress')
  String? get quoteTokenAddress;

  /// 路由合约地址，仅对 DEX 生效
  @BuiltValueField(wireName: r'routerAddress')
  String? get routerAddress;

  /// 池子合约地址，仅对 DEX 生效
  @BuiltValueField(wireName: r'poolAddress')
  String? get poolAddress;

  /// DEX 名称，例如 UNISWAP_V3，仅对 DEX 生效
  @BuiltValueField(wireName: r'dexName')
  String? get dexName;

  TradingPairConfigResponseDto._();

  factory TradingPairConfigResponseDto([void updates(TradingPairConfigResponseDtoBuilder b)]) = _$TradingPairConfigResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(TradingPairConfigResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<TradingPairConfigResponseDto> get serializer => _$TradingPairConfigResponseDtoSerializer();
}

class _$TradingPairConfigResponseDtoSerializer implements PrimitiveSerializer<TradingPairConfigResponseDto> {
  @override
  final Iterable<Type> types = const [TradingPairConfigResponseDto, _$TradingPairConfigResponseDto];

  @override
  final String wireName = r'TradingPairConfigResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    TradingPairConfigResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'displaySymbol';
    yield serializers.serialize(
      object.displaySymbol,
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
      specifiedType: const FullType(TradingPairConfigResponseDtoVenueTypeEnum),
    );
    yield r'instrumentType';
    yield serializers.serialize(
      object.instrumentType,
      specifiedType: const FullType(TradingPairConfigResponseDtoInstrumentTypeEnum),
    );
    yield r'pricePrecision';
    yield serializers.serialize(
      object.pricePrecision,
      specifiedType: const FullType(num),
    );
    yield r'quantityPrecision';
    yield serializers.serialize(
      object.quantityPrecision,
      specifiedType: const FullType(num),
    );
    if (object.minNotional != null) {
      yield r'minNotional';
      yield serializers.serialize(
        object.minNotional,
        specifiedType: const FullType(num),
      );
    }
    if (object.minQuantity != null) {
      yield r'minQuantity';
      yield serializers.serialize(
        object.minQuantity,
        specifiedType: const FullType(num),
      );
    }
    yield r'enabled';
    yield serializers.serialize(
      object.enabled,
      specifiedType: const FullType(bool),
    );
    if (object.exchange != null) {
      yield r'exchange';
      yield serializers.serialize(
        object.exchange,
        specifiedType: const FullType(TradingPairConfigResponseDtoExchangeEnum),
      );
    }
    if (object.exchangeSymbol != null) {
      yield r'exchangeSymbol';
      yield serializers.serialize(
        object.exchangeSymbol,
        specifiedType: const FullType(String),
      );
    }
    if (object.maxLeverage != null) {
      yield r'maxLeverage';
      yield serializers.serialize(
        object.maxLeverage,
        specifiedType: const FullType(num),
      );
    }
    if (object.contractSize != null) {
      yield r'contractSize';
      yield serializers.serialize(
        object.contractSize,
        specifiedType: const FullType(num),
      );
    }
    if (object.chainId != null) {
      yield r'chainId';
      yield serializers.serialize(
        object.chainId,
        specifiedType: const FullType(num),
      );
    }
    if (object.baseTokenAddress != null) {
      yield r'baseTokenAddress';
      yield serializers.serialize(
        object.baseTokenAddress,
        specifiedType: const FullType(String),
      );
    }
    if (object.quoteTokenAddress != null) {
      yield r'quoteTokenAddress';
      yield serializers.serialize(
        object.quoteTokenAddress,
        specifiedType: const FullType(String),
      );
    }
    if (object.routerAddress != null) {
      yield r'routerAddress';
      yield serializers.serialize(
        object.routerAddress,
        specifiedType: const FullType(String),
      );
    }
    if (object.poolAddress != null) {
      yield r'poolAddress';
      yield serializers.serialize(
        object.poolAddress,
        specifiedType: const FullType(String),
      );
    }
    if (object.dexName != null) {
      yield r'dexName';
      yield serializers.serialize(
        object.dexName,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    TradingPairConfigResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required TradingPairConfigResponseDtoBuilder result,
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
        case r'displaySymbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.displaySymbol = valueDes;
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
            specifiedType: const FullType(TradingPairConfigResponseDtoVenueTypeEnum),
          ) as TradingPairConfigResponseDtoVenueTypeEnum;
          result.venueType = valueDes;
          break;
        case r'instrumentType':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(TradingPairConfigResponseDtoInstrumentTypeEnum),
          ) as TradingPairConfigResponseDtoInstrumentTypeEnum;
          result.instrumentType = valueDes;
          break;
        case r'pricePrecision':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.pricePrecision = valueDes;
          break;
        case r'quantityPrecision':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.quantityPrecision = valueDes;
          break;
        case r'minNotional':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.minNotional = valueDes;
          break;
        case r'minQuantity':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.minQuantity = valueDes;
          break;
        case r'enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.enabled = valueDes;
          break;
        case r'exchange':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(TradingPairConfigResponseDtoExchangeEnum),
          ) as TradingPairConfigResponseDtoExchangeEnum;
          result.exchange = valueDes;
          break;
        case r'exchangeSymbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.exchangeSymbol = valueDes;
          break;
        case r'maxLeverage':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.maxLeverage = valueDes;
          break;
        case r'contractSize':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.contractSize = valueDes;
          break;
        case r'chainId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.chainId = valueDes;
          break;
        case r'baseTokenAddress':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.baseTokenAddress = valueDes;
          break;
        case r'quoteTokenAddress':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.quoteTokenAddress = valueDes;
          break;
        case r'routerAddress':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.routerAddress = valueDes;
          break;
        case r'poolAddress':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.poolAddress = valueDes;
          break;
        case r'dexName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.dexName = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  TradingPairConfigResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = TradingPairConfigResponseDtoBuilder();
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

class TradingPairConfigResponseDtoVenueTypeEnum extends EnumClass {

  /// 交易 venue 类型（DEX / CEX）
  @BuiltValueEnumConst(wireName: r'DEX')
  static const TradingPairConfigResponseDtoVenueTypeEnum DEX = _$tradingPairConfigResponseDtoVenueTypeEnum_DEX;
  /// 交易 venue 类型（DEX / CEX）
  @BuiltValueEnumConst(wireName: r'CEX')
  static const TradingPairConfigResponseDtoVenueTypeEnum CEX = _$tradingPairConfigResponseDtoVenueTypeEnum_CEX;

  static Serializer<TradingPairConfigResponseDtoVenueTypeEnum> get serializer => _$tradingPairConfigResponseDtoVenueTypeEnumSerializer;

  const TradingPairConfigResponseDtoVenueTypeEnum._(String name): super(name);

  static BuiltSet<TradingPairConfigResponseDtoVenueTypeEnum> get values => _$tradingPairConfigResponseDtoVenueTypeEnumValues;
  static TradingPairConfigResponseDtoVenueTypeEnum valueOf(String name) => _$tradingPairConfigResponseDtoVenueTypeEnumValueOf(name);
}

class TradingPairConfigResponseDtoInstrumentTypeEnum extends EnumClass {

  /// 交易品种类型（现货 / 永续 / 期货）
  @BuiltValueEnumConst(wireName: r'SPOT')
  static const TradingPairConfigResponseDtoInstrumentTypeEnum SPOT = _$tradingPairConfigResponseDtoInstrumentTypeEnum_SPOT;
  /// 交易品种类型（现货 / 永续 / 期货）
  @BuiltValueEnumConst(wireName: r'PERPETUAL')
  static const TradingPairConfigResponseDtoInstrumentTypeEnum PERPETUAL = _$tradingPairConfigResponseDtoInstrumentTypeEnum_PERPETUAL;
  /// 交易品种类型（现货 / 永续 / 期货）
  @BuiltValueEnumConst(wireName: r'FUTURE')
  static const TradingPairConfigResponseDtoInstrumentTypeEnum FUTURE = _$tradingPairConfigResponseDtoInstrumentTypeEnum_FUTURE;

  static Serializer<TradingPairConfigResponseDtoInstrumentTypeEnum> get serializer => _$tradingPairConfigResponseDtoInstrumentTypeEnumSerializer;

  const TradingPairConfigResponseDtoInstrumentTypeEnum._(String name): super(name);

  static BuiltSet<TradingPairConfigResponseDtoInstrumentTypeEnum> get values => _$tradingPairConfigResponseDtoInstrumentTypeEnumValues;
  static TradingPairConfigResponseDtoInstrumentTypeEnum valueOf(String name) => _$tradingPairConfigResponseDtoInstrumentTypeEnumValueOf(name);
}

class TradingPairConfigResponseDtoExchangeEnum extends EnumClass {

  /// 交易所标识，仅对 CEX 生效
  @BuiltValueEnumConst(wireName: r'BINANCE')
  static const TradingPairConfigResponseDtoExchangeEnum BINANCE = _$tradingPairConfigResponseDtoExchangeEnum_BINANCE;
  /// 交易所标识，仅对 CEX 生效
  @BuiltValueEnumConst(wireName: r'OKX')
  static const TradingPairConfigResponseDtoExchangeEnum OKX = _$tradingPairConfigResponseDtoExchangeEnum_OKX;
  /// 交易所标识，仅对 CEX 生效
  @BuiltValueEnumConst(wireName: r'BYBIT')
  static const TradingPairConfigResponseDtoExchangeEnum BYBIT = _$tradingPairConfigResponseDtoExchangeEnum_BYBIT;

  static Serializer<TradingPairConfigResponseDtoExchangeEnum> get serializer => _$tradingPairConfigResponseDtoExchangeEnumSerializer;

  const TradingPairConfigResponseDtoExchangeEnum._(String name): super(name);

  static BuiltSet<TradingPairConfigResponseDtoExchangeEnum> get values => _$tradingPairConfigResponseDtoExchangeEnumValues;
  static TradingPairConfigResponseDtoExchangeEnum valueOf(String name) => _$tradingPairConfigResponseDtoExchangeEnumValueOf(name);
}

