// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_open_interest_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CreateOpenInterestDto extends CreateOpenInterestDto {
  @override
  final String exchange;
  @override
  final String symbol;
  @override
  final num openInterestUsd;
  @override
  final num openInterestQuantity;
  @override
  final num? openInterestByStableCoinMargin;
  @override
  final num? openInterestByCoinMargin;
  @override
  final num? openInterestQuantityByCoinMargin;
  @override
  final num? openInterestQuantityByStableCoinMargin;
  @override
  final num? openInterestChangePercent5m;
  @override
  final num? openInterestChangePercent15m;
  @override
  final num? openInterestChangePercent30m;
  @override
  final num? openInterestChangePercent1h;
  @override
  final num? openInterestChangePercent4h;
  @override
  final num? openInterestChangePercent24h;
  @override
  final String dataTimestamp;

  factory _$CreateOpenInterestDto([
    void Function(CreateOpenInterestDtoBuilder)? updates,
  ]) => (CreateOpenInterestDtoBuilder()..update(updates))._build();

  _$CreateOpenInterestDto._({
    required this.exchange,
    required this.symbol,
    required this.openInterestUsd,
    required this.openInterestQuantity,
    this.openInterestByStableCoinMargin,
    this.openInterestByCoinMargin,
    this.openInterestQuantityByCoinMargin,
    this.openInterestQuantityByStableCoinMargin,
    this.openInterestChangePercent5m,
    this.openInterestChangePercent15m,
    this.openInterestChangePercent30m,
    this.openInterestChangePercent1h,
    this.openInterestChangePercent4h,
    this.openInterestChangePercent24h,
    required this.dataTimestamp,
  }) : super._();
  @override
  CreateOpenInterestDto rebuild(
    void Function(CreateOpenInterestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CreateOpenInterestDtoBuilder toBuilder() =>
      CreateOpenInterestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateOpenInterestDto &&
        exchange == other.exchange &&
        symbol == other.symbol &&
        openInterestUsd == other.openInterestUsd &&
        openInterestQuantity == other.openInterestQuantity &&
        openInterestByStableCoinMargin ==
            other.openInterestByStableCoinMargin &&
        openInterestByCoinMargin == other.openInterestByCoinMargin &&
        openInterestQuantityByCoinMargin ==
            other.openInterestQuantityByCoinMargin &&
        openInterestQuantityByStableCoinMargin ==
            other.openInterestQuantityByStableCoinMargin &&
        openInterestChangePercent5m == other.openInterestChangePercent5m &&
        openInterestChangePercent15m == other.openInterestChangePercent15m &&
        openInterestChangePercent30m == other.openInterestChangePercent30m &&
        openInterestChangePercent1h == other.openInterestChangePercent1h &&
        openInterestChangePercent4h == other.openInterestChangePercent4h &&
        openInterestChangePercent24h == other.openInterestChangePercent24h &&
        dataTimestamp == other.dataTimestamp;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, exchange.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, openInterestUsd.hashCode);
    _$hash = $jc(_$hash, openInterestQuantity.hashCode);
    _$hash = $jc(_$hash, openInterestByStableCoinMargin.hashCode);
    _$hash = $jc(_$hash, openInterestByCoinMargin.hashCode);
    _$hash = $jc(_$hash, openInterestQuantityByCoinMargin.hashCode);
    _$hash = $jc(_$hash, openInterestQuantityByStableCoinMargin.hashCode);
    _$hash = $jc(_$hash, openInterestChangePercent5m.hashCode);
    _$hash = $jc(_$hash, openInterestChangePercent15m.hashCode);
    _$hash = $jc(_$hash, openInterestChangePercent30m.hashCode);
    _$hash = $jc(_$hash, openInterestChangePercent1h.hashCode);
    _$hash = $jc(_$hash, openInterestChangePercent4h.hashCode);
    _$hash = $jc(_$hash, openInterestChangePercent24h.hashCode);
    _$hash = $jc(_$hash, dataTimestamp.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateOpenInterestDto')
          ..add('exchange', exchange)
          ..add('symbol', symbol)
          ..add('openInterestUsd', openInterestUsd)
          ..add('openInterestQuantity', openInterestQuantity)
          ..add(
            'openInterestByStableCoinMargin',
            openInterestByStableCoinMargin,
          )
          ..add('openInterestByCoinMargin', openInterestByCoinMargin)
          ..add(
            'openInterestQuantityByCoinMargin',
            openInterestQuantityByCoinMargin,
          )
          ..add(
            'openInterestQuantityByStableCoinMargin',
            openInterestQuantityByStableCoinMargin,
          )
          ..add('openInterestChangePercent5m', openInterestChangePercent5m)
          ..add('openInterestChangePercent15m', openInterestChangePercent15m)
          ..add('openInterestChangePercent30m', openInterestChangePercent30m)
          ..add('openInterestChangePercent1h', openInterestChangePercent1h)
          ..add('openInterestChangePercent4h', openInterestChangePercent4h)
          ..add('openInterestChangePercent24h', openInterestChangePercent24h)
          ..add('dataTimestamp', dataTimestamp))
        .toString();
  }
}

class CreateOpenInterestDtoBuilder
    implements Builder<CreateOpenInterestDto, CreateOpenInterestDtoBuilder> {
  _$CreateOpenInterestDto? _$v;

  String? _exchange;
  String? get exchange => _$this._exchange;
  set exchange(String? exchange) => _$this._exchange = exchange;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  num? _openInterestUsd;
  num? get openInterestUsd => _$this._openInterestUsd;
  set openInterestUsd(num? openInterestUsd) =>
      _$this._openInterestUsd = openInterestUsd;

  num? _openInterestQuantity;
  num? get openInterestQuantity => _$this._openInterestQuantity;
  set openInterestQuantity(num? openInterestQuantity) =>
      _$this._openInterestQuantity = openInterestQuantity;

  num? _openInterestByStableCoinMargin;
  num? get openInterestByStableCoinMargin =>
      _$this._openInterestByStableCoinMargin;
  set openInterestByStableCoinMargin(num? openInterestByStableCoinMargin) =>
      _$this._openInterestByStableCoinMargin = openInterestByStableCoinMargin;

  num? _openInterestByCoinMargin;
  num? get openInterestByCoinMargin => _$this._openInterestByCoinMargin;
  set openInterestByCoinMargin(num? openInterestByCoinMargin) =>
      _$this._openInterestByCoinMargin = openInterestByCoinMargin;

  num? _openInterestQuantityByCoinMargin;
  num? get openInterestQuantityByCoinMargin =>
      _$this._openInterestQuantityByCoinMargin;
  set openInterestQuantityByCoinMargin(num? openInterestQuantityByCoinMargin) =>
      _$this._openInterestQuantityByCoinMargin =
          openInterestQuantityByCoinMargin;

  num? _openInterestQuantityByStableCoinMargin;
  num? get openInterestQuantityByStableCoinMargin =>
      _$this._openInterestQuantityByStableCoinMargin;
  set openInterestQuantityByStableCoinMargin(
    num? openInterestQuantityByStableCoinMargin,
  ) => _$this._openInterestQuantityByStableCoinMargin =
      openInterestQuantityByStableCoinMargin;

  num? _openInterestChangePercent5m;
  num? get openInterestChangePercent5m => _$this._openInterestChangePercent5m;
  set openInterestChangePercent5m(num? openInterestChangePercent5m) =>
      _$this._openInterestChangePercent5m = openInterestChangePercent5m;

  num? _openInterestChangePercent15m;
  num? get openInterestChangePercent15m => _$this._openInterestChangePercent15m;
  set openInterestChangePercent15m(num? openInterestChangePercent15m) =>
      _$this._openInterestChangePercent15m = openInterestChangePercent15m;

  num? _openInterestChangePercent30m;
  num? get openInterestChangePercent30m => _$this._openInterestChangePercent30m;
  set openInterestChangePercent30m(num? openInterestChangePercent30m) =>
      _$this._openInterestChangePercent30m = openInterestChangePercent30m;

  num? _openInterestChangePercent1h;
  num? get openInterestChangePercent1h => _$this._openInterestChangePercent1h;
  set openInterestChangePercent1h(num? openInterestChangePercent1h) =>
      _$this._openInterestChangePercent1h = openInterestChangePercent1h;

  num? _openInterestChangePercent4h;
  num? get openInterestChangePercent4h => _$this._openInterestChangePercent4h;
  set openInterestChangePercent4h(num? openInterestChangePercent4h) =>
      _$this._openInterestChangePercent4h = openInterestChangePercent4h;

  num? _openInterestChangePercent24h;
  num? get openInterestChangePercent24h => _$this._openInterestChangePercent24h;
  set openInterestChangePercent24h(num? openInterestChangePercent24h) =>
      _$this._openInterestChangePercent24h = openInterestChangePercent24h;

  String? _dataTimestamp;
  String? get dataTimestamp => _$this._dataTimestamp;
  set dataTimestamp(String? dataTimestamp) =>
      _$this._dataTimestamp = dataTimestamp;

  CreateOpenInterestDtoBuilder() {
    CreateOpenInterestDto._defaults(this);
  }

  CreateOpenInterestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _exchange = $v.exchange;
      _symbol = $v.symbol;
      _openInterestUsd = $v.openInterestUsd;
      _openInterestQuantity = $v.openInterestQuantity;
      _openInterestByStableCoinMargin = $v.openInterestByStableCoinMargin;
      _openInterestByCoinMargin = $v.openInterestByCoinMargin;
      _openInterestQuantityByCoinMargin = $v.openInterestQuantityByCoinMargin;
      _openInterestQuantityByStableCoinMargin =
          $v.openInterestQuantityByStableCoinMargin;
      _openInterestChangePercent5m = $v.openInterestChangePercent5m;
      _openInterestChangePercent15m = $v.openInterestChangePercent15m;
      _openInterestChangePercent30m = $v.openInterestChangePercent30m;
      _openInterestChangePercent1h = $v.openInterestChangePercent1h;
      _openInterestChangePercent4h = $v.openInterestChangePercent4h;
      _openInterestChangePercent24h = $v.openInterestChangePercent24h;
      _dataTimestamp = $v.dataTimestamp;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateOpenInterestDto other) {
    _$v = other as _$CreateOpenInterestDto;
  }

  @override
  void update(void Function(CreateOpenInterestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateOpenInterestDto build() => _build();

  _$CreateOpenInterestDto _build() {
    final _$result =
        _$v ??
        _$CreateOpenInterestDto._(
          exchange: BuiltValueNullFieldError.checkNotNull(
            exchange,
            r'CreateOpenInterestDto',
            'exchange',
          ),
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'CreateOpenInterestDto',
            'symbol',
          ),
          openInterestUsd: BuiltValueNullFieldError.checkNotNull(
            openInterestUsd,
            r'CreateOpenInterestDto',
            'openInterestUsd',
          ),
          openInterestQuantity: BuiltValueNullFieldError.checkNotNull(
            openInterestQuantity,
            r'CreateOpenInterestDto',
            'openInterestQuantity',
          ),
          openInterestByStableCoinMargin: openInterestByStableCoinMargin,
          openInterestByCoinMargin: openInterestByCoinMargin,
          openInterestQuantityByCoinMargin: openInterestQuantityByCoinMargin,
          openInterestQuantityByStableCoinMargin:
              openInterestQuantityByStableCoinMargin,
          openInterestChangePercent5m: openInterestChangePercent5m,
          openInterestChangePercent15m: openInterestChangePercent15m,
          openInterestChangePercent30m: openInterestChangePercent30m,
          openInterestChangePercent1h: openInterestChangePercent1h,
          openInterestChangePercent4h: openInterestChangePercent4h,
          openInterestChangePercent24h: openInterestChangePercent24h,
          dataTimestamp: BuiltValueNullFieldError.checkNotNull(
            dataTimestamp,
            r'CreateOpenInterestDto',
            'dataTimestamp',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
