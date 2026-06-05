// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_trade_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const WhaleTradeDtoSideEnum _$whaleTradeDtoSideEnum_long =
    const WhaleTradeDtoSideEnum._('long');
const WhaleTradeDtoSideEnum _$whaleTradeDtoSideEnum_short =
    const WhaleTradeDtoSideEnum._('short');

WhaleTradeDtoSideEnum _$whaleTradeDtoSideEnumValueOf(String name) {
  switch (name) {
    case 'long':
      return _$whaleTradeDtoSideEnum_long;
    case 'short':
      return _$whaleTradeDtoSideEnum_short;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<WhaleTradeDtoSideEnum> _$whaleTradeDtoSideEnumValues =
    BuiltSet<WhaleTradeDtoSideEnum>(const <WhaleTradeDtoSideEnum>[
      _$whaleTradeDtoSideEnum_long,
      _$whaleTradeDtoSideEnum_short,
    ]);

Serializer<WhaleTradeDtoSideEnum> _$whaleTradeDtoSideEnumSerializer =
    _$WhaleTradeDtoSideEnumSerializer();

class _$WhaleTradeDtoSideEnumSerializer
    implements PrimitiveSerializer<WhaleTradeDtoSideEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'long': 'Long',
    'short': 'Short',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'Long': 'long',
    'Short': 'short',
  };

  @override
  final Iterable<Type> types = const <Type>[WhaleTradeDtoSideEnum];
  @override
  final String wireName = 'WhaleTradeDtoSideEnum';

  @override
  Object serialize(
    Serializers serializers,
    WhaleTradeDtoSideEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  WhaleTradeDtoSideEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => WhaleTradeDtoSideEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$WhaleTradeDto extends WhaleTradeDto {
  @override
  final String userAddress;
  @override
  final String symbol;
  @override
  final WhaleTradeDtoSideEnum side;
  @override
  final num tradeSize;
  @override
  final num price;
  @override
  final num tradeValueUsd;
  @override
  final String tradeTime;

  factory _$WhaleTradeDto([void Function(WhaleTradeDtoBuilder)? updates]) =>
      (WhaleTradeDtoBuilder()..update(updates))._build();

  _$WhaleTradeDto._({
    required this.userAddress,
    required this.symbol,
    required this.side,
    required this.tradeSize,
    required this.price,
    required this.tradeValueUsd,
    required this.tradeTime,
  }) : super._();
  @override
  WhaleTradeDto rebuild(void Function(WhaleTradeDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  WhaleTradeDtoBuilder toBuilder() => WhaleTradeDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleTradeDto &&
        userAddress == other.userAddress &&
        symbol == other.symbol &&
        side == other.side &&
        tradeSize == other.tradeSize &&
        price == other.price &&
        tradeValueUsd == other.tradeValueUsd &&
        tradeTime == other.tradeTime;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, userAddress.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, side.hashCode);
    _$hash = $jc(_$hash, tradeSize.hashCode);
    _$hash = $jc(_$hash, price.hashCode);
    _$hash = $jc(_$hash, tradeValueUsd.hashCode);
    _$hash = $jc(_$hash, tradeTime.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'WhaleTradeDto')
          ..add('userAddress', userAddress)
          ..add('symbol', symbol)
          ..add('side', side)
          ..add('tradeSize', tradeSize)
          ..add('price', price)
          ..add('tradeValueUsd', tradeValueUsd)
          ..add('tradeTime', tradeTime))
        .toString();
  }
}

class WhaleTradeDtoBuilder
    implements Builder<WhaleTradeDto, WhaleTradeDtoBuilder> {
  _$WhaleTradeDto? _$v;

  String? _userAddress;
  String? get userAddress => _$this._userAddress;
  set userAddress(String? userAddress) => _$this._userAddress = userAddress;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  WhaleTradeDtoSideEnum? _side;
  WhaleTradeDtoSideEnum? get side => _$this._side;
  set side(WhaleTradeDtoSideEnum? side) => _$this._side = side;

  num? _tradeSize;
  num? get tradeSize => _$this._tradeSize;
  set tradeSize(num? tradeSize) => _$this._tradeSize = tradeSize;

  num? _price;
  num? get price => _$this._price;
  set price(num? price) => _$this._price = price;

  num? _tradeValueUsd;
  num? get tradeValueUsd => _$this._tradeValueUsd;
  set tradeValueUsd(num? tradeValueUsd) =>
      _$this._tradeValueUsd = tradeValueUsd;

  String? _tradeTime;
  String? get tradeTime => _$this._tradeTime;
  set tradeTime(String? tradeTime) => _$this._tradeTime = tradeTime;

  WhaleTradeDtoBuilder() {
    WhaleTradeDto._defaults(this);
  }

  WhaleTradeDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _userAddress = $v.userAddress;
      _symbol = $v.symbol;
      _side = $v.side;
      _tradeSize = $v.tradeSize;
      _price = $v.price;
      _tradeValueUsd = $v.tradeValueUsd;
      _tradeTime = $v.tradeTime;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(WhaleTradeDto other) {
    _$v = other as _$WhaleTradeDto;
  }

  @override
  void update(void Function(WhaleTradeDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  WhaleTradeDto build() => _build();

  _$WhaleTradeDto _build() {
    final _$result =
        _$v ??
        _$WhaleTradeDto._(
          userAddress: BuiltValueNullFieldError.checkNotNull(
            userAddress,
            r'WhaleTradeDto',
            'userAddress',
          ),
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'WhaleTradeDto',
            'symbol',
          ),
          side: BuiltValueNullFieldError.checkNotNull(
            side,
            r'WhaleTradeDto',
            'side',
          ),
          tradeSize: BuiltValueNullFieldError.checkNotNull(
            tradeSize,
            r'WhaleTradeDto',
            'tradeSize',
          ),
          price: BuiltValueNullFieldError.checkNotNull(
            price,
            r'WhaleTradeDto',
            'price',
          ),
          tradeValueUsd: BuiltValueNullFieldError.checkNotNull(
            tradeValueUsd,
            r'WhaleTradeDto',
            'tradeValueUsd',
          ),
          tradeTime: BuiltValueNullFieldError.checkNotNull(
            tradeTime,
            r'WhaleTradeDto',
            'tradeTime',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
