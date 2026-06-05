// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'trading_pair_config_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const TradingPairConfigResponseDtoVenueTypeEnum
_$tradingPairConfigResponseDtoVenueTypeEnum_DEX =
    const TradingPairConfigResponseDtoVenueTypeEnum._('DEX');
const TradingPairConfigResponseDtoVenueTypeEnum
_$tradingPairConfigResponseDtoVenueTypeEnum_CEX =
    const TradingPairConfigResponseDtoVenueTypeEnum._('CEX');

TradingPairConfigResponseDtoVenueTypeEnum
_$tradingPairConfigResponseDtoVenueTypeEnumValueOf(String name) {
  switch (name) {
    case 'DEX':
      return _$tradingPairConfigResponseDtoVenueTypeEnum_DEX;
    case 'CEX':
      return _$tradingPairConfigResponseDtoVenueTypeEnum_CEX;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<TradingPairConfigResponseDtoVenueTypeEnum>
_$tradingPairConfigResponseDtoVenueTypeEnumValues =
    BuiltSet<TradingPairConfigResponseDtoVenueTypeEnum>(
      const <TradingPairConfigResponseDtoVenueTypeEnum>[
        _$tradingPairConfigResponseDtoVenueTypeEnum_DEX,
        _$tradingPairConfigResponseDtoVenueTypeEnum_CEX,
      ],
    );

const TradingPairConfigResponseDtoInstrumentTypeEnum
_$tradingPairConfigResponseDtoInstrumentTypeEnum_SPOT =
    const TradingPairConfigResponseDtoInstrumentTypeEnum._('SPOT');
const TradingPairConfigResponseDtoInstrumentTypeEnum
_$tradingPairConfigResponseDtoInstrumentTypeEnum_PERPETUAL =
    const TradingPairConfigResponseDtoInstrumentTypeEnum._('PERPETUAL');
const TradingPairConfigResponseDtoInstrumentTypeEnum
_$tradingPairConfigResponseDtoInstrumentTypeEnum_FUTURE =
    const TradingPairConfigResponseDtoInstrumentTypeEnum._('FUTURE');

TradingPairConfigResponseDtoInstrumentTypeEnum
_$tradingPairConfigResponseDtoInstrumentTypeEnumValueOf(String name) {
  switch (name) {
    case 'SPOT':
      return _$tradingPairConfigResponseDtoInstrumentTypeEnum_SPOT;
    case 'PERPETUAL':
      return _$tradingPairConfigResponseDtoInstrumentTypeEnum_PERPETUAL;
    case 'FUTURE':
      return _$tradingPairConfigResponseDtoInstrumentTypeEnum_FUTURE;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<TradingPairConfigResponseDtoInstrumentTypeEnum>
_$tradingPairConfigResponseDtoInstrumentTypeEnumValues =
    BuiltSet<TradingPairConfigResponseDtoInstrumentTypeEnum>(
      const <TradingPairConfigResponseDtoInstrumentTypeEnum>[
        _$tradingPairConfigResponseDtoInstrumentTypeEnum_SPOT,
        _$tradingPairConfigResponseDtoInstrumentTypeEnum_PERPETUAL,
        _$tradingPairConfigResponseDtoInstrumentTypeEnum_FUTURE,
      ],
    );

const TradingPairConfigResponseDtoExchangeEnum
_$tradingPairConfigResponseDtoExchangeEnum_BINANCE =
    const TradingPairConfigResponseDtoExchangeEnum._('BINANCE');
const TradingPairConfigResponseDtoExchangeEnum
_$tradingPairConfigResponseDtoExchangeEnum_OKX =
    const TradingPairConfigResponseDtoExchangeEnum._('OKX');
const TradingPairConfigResponseDtoExchangeEnum
_$tradingPairConfigResponseDtoExchangeEnum_BYBIT =
    const TradingPairConfigResponseDtoExchangeEnum._('BYBIT');

TradingPairConfigResponseDtoExchangeEnum
_$tradingPairConfigResponseDtoExchangeEnumValueOf(String name) {
  switch (name) {
    case 'BINANCE':
      return _$tradingPairConfigResponseDtoExchangeEnum_BINANCE;
    case 'OKX':
      return _$tradingPairConfigResponseDtoExchangeEnum_OKX;
    case 'BYBIT':
      return _$tradingPairConfigResponseDtoExchangeEnum_BYBIT;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<TradingPairConfigResponseDtoExchangeEnum>
_$tradingPairConfigResponseDtoExchangeEnumValues =
    BuiltSet<TradingPairConfigResponseDtoExchangeEnum>(
      const <TradingPairConfigResponseDtoExchangeEnum>[
        _$tradingPairConfigResponseDtoExchangeEnum_BINANCE,
        _$tradingPairConfigResponseDtoExchangeEnum_OKX,
        _$tradingPairConfigResponseDtoExchangeEnum_BYBIT,
      ],
    );

Serializer<TradingPairConfigResponseDtoVenueTypeEnum>
_$tradingPairConfigResponseDtoVenueTypeEnumSerializer =
    _$TradingPairConfigResponseDtoVenueTypeEnumSerializer();
Serializer<TradingPairConfigResponseDtoInstrumentTypeEnum>
_$tradingPairConfigResponseDtoInstrumentTypeEnumSerializer =
    _$TradingPairConfigResponseDtoInstrumentTypeEnumSerializer();
Serializer<TradingPairConfigResponseDtoExchangeEnum>
_$tradingPairConfigResponseDtoExchangeEnumSerializer =
    _$TradingPairConfigResponseDtoExchangeEnumSerializer();

class _$TradingPairConfigResponseDtoVenueTypeEnumSerializer
    implements PrimitiveSerializer<TradingPairConfigResponseDtoVenueTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'DEX': 'DEX',
    'CEX': 'CEX',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'DEX': 'DEX',
    'CEX': 'CEX',
  };

  @override
  final Iterable<Type> types = const <Type>[
    TradingPairConfigResponseDtoVenueTypeEnum,
  ];
  @override
  final String wireName = 'TradingPairConfigResponseDtoVenueTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    TradingPairConfigResponseDtoVenueTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  TradingPairConfigResponseDtoVenueTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => TradingPairConfigResponseDtoVenueTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$TradingPairConfigResponseDtoInstrumentTypeEnumSerializer
    implements
        PrimitiveSerializer<TradingPairConfigResponseDtoInstrumentTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'SPOT': 'SPOT',
    'PERPETUAL': 'PERPETUAL',
    'FUTURE': 'FUTURE',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'SPOT': 'SPOT',
    'PERPETUAL': 'PERPETUAL',
    'FUTURE': 'FUTURE',
  };

  @override
  final Iterable<Type> types = const <Type>[
    TradingPairConfigResponseDtoInstrumentTypeEnum,
  ];
  @override
  final String wireName = 'TradingPairConfigResponseDtoInstrumentTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    TradingPairConfigResponseDtoInstrumentTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  TradingPairConfigResponseDtoInstrumentTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => TradingPairConfigResponseDtoInstrumentTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$TradingPairConfigResponseDtoExchangeEnumSerializer
    implements PrimitiveSerializer<TradingPairConfigResponseDtoExchangeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'BINANCE': 'BINANCE',
    'OKX': 'OKX',
    'BYBIT': 'BYBIT',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'BINANCE': 'BINANCE',
    'OKX': 'OKX',
    'BYBIT': 'BYBIT',
  };

  @override
  final Iterable<Type> types = const <Type>[
    TradingPairConfigResponseDtoExchangeEnum,
  ];
  @override
  final String wireName = 'TradingPairConfigResponseDtoExchangeEnum';

  @override
  Object serialize(
    Serializers serializers,
    TradingPairConfigResponseDtoExchangeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  TradingPairConfigResponseDtoExchangeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => TradingPairConfigResponseDtoExchangeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$TradingPairConfigResponseDto extends TradingPairConfigResponseDto {
  @override
  final String id;
  @override
  final String displaySymbol;
  @override
  final String symbol;
  @override
  final String baseAsset;
  @override
  final String quoteAsset;
  @override
  final TradingPairConfigResponseDtoVenueTypeEnum venueType;
  @override
  final TradingPairConfigResponseDtoInstrumentTypeEnum instrumentType;
  @override
  final num pricePrecision;
  @override
  final num quantityPrecision;
  @override
  final num? minNotional;
  @override
  final num? minQuantity;
  @override
  final bool enabled;
  @override
  final TradingPairConfigResponseDtoExchangeEnum? exchange;
  @override
  final String? exchangeSymbol;
  @override
  final num? maxLeverage;
  @override
  final num? contractSize;
  @override
  final num? chainId;
  @override
  final String? baseTokenAddress;
  @override
  final String? quoteTokenAddress;
  @override
  final String? routerAddress;
  @override
  final String? poolAddress;
  @override
  final String? dexName;

  factory _$TradingPairConfigResponseDto([
    void Function(TradingPairConfigResponseDtoBuilder)? updates,
  ]) => (TradingPairConfigResponseDtoBuilder()..update(updates))._build();

  _$TradingPairConfigResponseDto._({
    required this.id,
    required this.displaySymbol,
    required this.symbol,
    required this.baseAsset,
    required this.quoteAsset,
    required this.venueType,
    required this.instrumentType,
    required this.pricePrecision,
    required this.quantityPrecision,
    this.minNotional,
    this.minQuantity,
    required this.enabled,
    this.exchange,
    this.exchangeSymbol,
    this.maxLeverage,
    this.contractSize,
    this.chainId,
    this.baseTokenAddress,
    this.quoteTokenAddress,
    this.routerAddress,
    this.poolAddress,
    this.dexName,
  }) : super._();
  @override
  TradingPairConfigResponseDto rebuild(
    void Function(TradingPairConfigResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TradingPairConfigResponseDtoBuilder toBuilder() =>
      TradingPairConfigResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TradingPairConfigResponseDto &&
        id == other.id &&
        displaySymbol == other.displaySymbol &&
        symbol == other.symbol &&
        baseAsset == other.baseAsset &&
        quoteAsset == other.quoteAsset &&
        venueType == other.venueType &&
        instrumentType == other.instrumentType &&
        pricePrecision == other.pricePrecision &&
        quantityPrecision == other.quantityPrecision &&
        minNotional == other.minNotional &&
        minQuantity == other.minQuantity &&
        enabled == other.enabled &&
        exchange == other.exchange &&
        exchangeSymbol == other.exchangeSymbol &&
        maxLeverage == other.maxLeverage &&
        contractSize == other.contractSize &&
        chainId == other.chainId &&
        baseTokenAddress == other.baseTokenAddress &&
        quoteTokenAddress == other.quoteTokenAddress &&
        routerAddress == other.routerAddress &&
        poolAddress == other.poolAddress &&
        dexName == other.dexName;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, displaySymbol.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, baseAsset.hashCode);
    _$hash = $jc(_$hash, quoteAsset.hashCode);
    _$hash = $jc(_$hash, venueType.hashCode);
    _$hash = $jc(_$hash, instrumentType.hashCode);
    _$hash = $jc(_$hash, pricePrecision.hashCode);
    _$hash = $jc(_$hash, quantityPrecision.hashCode);
    _$hash = $jc(_$hash, minNotional.hashCode);
    _$hash = $jc(_$hash, minQuantity.hashCode);
    _$hash = $jc(_$hash, enabled.hashCode);
    _$hash = $jc(_$hash, exchange.hashCode);
    _$hash = $jc(_$hash, exchangeSymbol.hashCode);
    _$hash = $jc(_$hash, maxLeverage.hashCode);
    _$hash = $jc(_$hash, contractSize.hashCode);
    _$hash = $jc(_$hash, chainId.hashCode);
    _$hash = $jc(_$hash, baseTokenAddress.hashCode);
    _$hash = $jc(_$hash, quoteTokenAddress.hashCode);
    _$hash = $jc(_$hash, routerAddress.hashCode);
    _$hash = $jc(_$hash, poolAddress.hashCode);
    _$hash = $jc(_$hash, dexName.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TradingPairConfigResponseDto')
          ..add('id', id)
          ..add('displaySymbol', displaySymbol)
          ..add('symbol', symbol)
          ..add('baseAsset', baseAsset)
          ..add('quoteAsset', quoteAsset)
          ..add('venueType', venueType)
          ..add('instrumentType', instrumentType)
          ..add('pricePrecision', pricePrecision)
          ..add('quantityPrecision', quantityPrecision)
          ..add('minNotional', minNotional)
          ..add('minQuantity', minQuantity)
          ..add('enabled', enabled)
          ..add('exchange', exchange)
          ..add('exchangeSymbol', exchangeSymbol)
          ..add('maxLeverage', maxLeverage)
          ..add('contractSize', contractSize)
          ..add('chainId', chainId)
          ..add('baseTokenAddress', baseTokenAddress)
          ..add('quoteTokenAddress', quoteTokenAddress)
          ..add('routerAddress', routerAddress)
          ..add('poolAddress', poolAddress)
          ..add('dexName', dexName))
        .toString();
  }
}

class TradingPairConfigResponseDtoBuilder
    implements
        Builder<
          TradingPairConfigResponseDto,
          TradingPairConfigResponseDtoBuilder
        > {
  _$TradingPairConfigResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _displaySymbol;
  String? get displaySymbol => _$this._displaySymbol;
  set displaySymbol(String? displaySymbol) =>
      _$this._displaySymbol = displaySymbol;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  String? _baseAsset;
  String? get baseAsset => _$this._baseAsset;
  set baseAsset(String? baseAsset) => _$this._baseAsset = baseAsset;

  String? _quoteAsset;
  String? get quoteAsset => _$this._quoteAsset;
  set quoteAsset(String? quoteAsset) => _$this._quoteAsset = quoteAsset;

  TradingPairConfigResponseDtoVenueTypeEnum? _venueType;
  TradingPairConfigResponseDtoVenueTypeEnum? get venueType => _$this._venueType;
  set venueType(TradingPairConfigResponseDtoVenueTypeEnum? venueType) =>
      _$this._venueType = venueType;

  TradingPairConfigResponseDtoInstrumentTypeEnum? _instrumentType;
  TradingPairConfigResponseDtoInstrumentTypeEnum? get instrumentType =>
      _$this._instrumentType;
  set instrumentType(
    TradingPairConfigResponseDtoInstrumentTypeEnum? instrumentType,
  ) => _$this._instrumentType = instrumentType;

  num? _pricePrecision;
  num? get pricePrecision => _$this._pricePrecision;
  set pricePrecision(num? pricePrecision) =>
      _$this._pricePrecision = pricePrecision;

  num? _quantityPrecision;
  num? get quantityPrecision => _$this._quantityPrecision;
  set quantityPrecision(num? quantityPrecision) =>
      _$this._quantityPrecision = quantityPrecision;

  num? _minNotional;
  num? get minNotional => _$this._minNotional;
  set minNotional(num? minNotional) => _$this._minNotional = minNotional;

  num? _minQuantity;
  num? get minQuantity => _$this._minQuantity;
  set minQuantity(num? minQuantity) => _$this._minQuantity = minQuantity;

  bool? _enabled;
  bool? get enabled => _$this._enabled;
  set enabled(bool? enabled) => _$this._enabled = enabled;

  TradingPairConfigResponseDtoExchangeEnum? _exchange;
  TradingPairConfigResponseDtoExchangeEnum? get exchange => _$this._exchange;
  set exchange(TradingPairConfigResponseDtoExchangeEnum? exchange) =>
      _$this._exchange = exchange;

  String? _exchangeSymbol;
  String? get exchangeSymbol => _$this._exchangeSymbol;
  set exchangeSymbol(String? exchangeSymbol) =>
      _$this._exchangeSymbol = exchangeSymbol;

  num? _maxLeverage;
  num? get maxLeverage => _$this._maxLeverage;
  set maxLeverage(num? maxLeverage) => _$this._maxLeverage = maxLeverage;

  num? _contractSize;
  num? get contractSize => _$this._contractSize;
  set contractSize(num? contractSize) => _$this._contractSize = contractSize;

  num? _chainId;
  num? get chainId => _$this._chainId;
  set chainId(num? chainId) => _$this._chainId = chainId;

  String? _baseTokenAddress;
  String? get baseTokenAddress => _$this._baseTokenAddress;
  set baseTokenAddress(String? baseTokenAddress) =>
      _$this._baseTokenAddress = baseTokenAddress;

  String? _quoteTokenAddress;
  String? get quoteTokenAddress => _$this._quoteTokenAddress;
  set quoteTokenAddress(String? quoteTokenAddress) =>
      _$this._quoteTokenAddress = quoteTokenAddress;

  String? _routerAddress;
  String? get routerAddress => _$this._routerAddress;
  set routerAddress(String? routerAddress) =>
      _$this._routerAddress = routerAddress;

  String? _poolAddress;
  String? get poolAddress => _$this._poolAddress;
  set poolAddress(String? poolAddress) => _$this._poolAddress = poolAddress;

  String? _dexName;
  String? get dexName => _$this._dexName;
  set dexName(String? dexName) => _$this._dexName = dexName;

  TradingPairConfigResponseDtoBuilder() {
    TradingPairConfigResponseDto._defaults(this);
  }

  TradingPairConfigResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _displaySymbol = $v.displaySymbol;
      _symbol = $v.symbol;
      _baseAsset = $v.baseAsset;
      _quoteAsset = $v.quoteAsset;
      _venueType = $v.venueType;
      _instrumentType = $v.instrumentType;
      _pricePrecision = $v.pricePrecision;
      _quantityPrecision = $v.quantityPrecision;
      _minNotional = $v.minNotional;
      _minQuantity = $v.minQuantity;
      _enabled = $v.enabled;
      _exchange = $v.exchange;
      _exchangeSymbol = $v.exchangeSymbol;
      _maxLeverage = $v.maxLeverage;
      _contractSize = $v.contractSize;
      _chainId = $v.chainId;
      _baseTokenAddress = $v.baseTokenAddress;
      _quoteTokenAddress = $v.quoteTokenAddress;
      _routerAddress = $v.routerAddress;
      _poolAddress = $v.poolAddress;
      _dexName = $v.dexName;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TradingPairConfigResponseDto other) {
    _$v = other as _$TradingPairConfigResponseDto;
  }

  @override
  void update(void Function(TradingPairConfigResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TradingPairConfigResponseDto build() => _build();

  _$TradingPairConfigResponseDto _build() {
    final _$result =
        _$v ??
        _$TradingPairConfigResponseDto._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'TradingPairConfigResponseDto',
            'id',
          ),
          displaySymbol: BuiltValueNullFieldError.checkNotNull(
            displaySymbol,
            r'TradingPairConfigResponseDto',
            'displaySymbol',
          ),
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'TradingPairConfigResponseDto',
            'symbol',
          ),
          baseAsset: BuiltValueNullFieldError.checkNotNull(
            baseAsset,
            r'TradingPairConfigResponseDto',
            'baseAsset',
          ),
          quoteAsset: BuiltValueNullFieldError.checkNotNull(
            quoteAsset,
            r'TradingPairConfigResponseDto',
            'quoteAsset',
          ),
          venueType: BuiltValueNullFieldError.checkNotNull(
            venueType,
            r'TradingPairConfigResponseDto',
            'venueType',
          ),
          instrumentType: BuiltValueNullFieldError.checkNotNull(
            instrumentType,
            r'TradingPairConfigResponseDto',
            'instrumentType',
          ),
          pricePrecision: BuiltValueNullFieldError.checkNotNull(
            pricePrecision,
            r'TradingPairConfigResponseDto',
            'pricePrecision',
          ),
          quantityPrecision: BuiltValueNullFieldError.checkNotNull(
            quantityPrecision,
            r'TradingPairConfigResponseDto',
            'quantityPrecision',
          ),
          minNotional: minNotional,
          minQuantity: minQuantity,
          enabled: BuiltValueNullFieldError.checkNotNull(
            enabled,
            r'TradingPairConfigResponseDto',
            'enabled',
          ),
          exchange: exchange,
          exchangeSymbol: exchangeSymbol,
          maxLeverage: maxLeverage,
          contractSize: contractSize,
          chainId: chainId,
          baseTokenAddress: baseTokenAddress,
          quoteTokenAddress: quoteTokenAddress,
          routerAddress: routerAddress,
          poolAddress: poolAddress,
          dexName: dexName,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
