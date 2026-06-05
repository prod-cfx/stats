// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ticker_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$TickerResponseDto extends TickerResponseDto {
  @override
  final String symbol;
  @override
  final String? exchange;
  @override
  final String currentPrice;
  @override
  final String? indexPrice;
  @override
  final String? priceChangePercent24h;
  @override
  final String volumeUsd;
  @override
  final String? openInterestUsd;
  @override
  final String? fundingRate;
  @override
  final String? nextFundingTime;
  @override
  final String? high24h;
  @override
  final String? low24h;

  factory _$TickerResponseDto([
    void Function(TickerResponseDtoBuilder)? updates,
  ]) => (TickerResponseDtoBuilder()..update(updates))._build();

  _$TickerResponseDto._({
    required this.symbol,
    this.exchange,
    required this.currentPrice,
    this.indexPrice,
    this.priceChangePercent24h,
    required this.volumeUsd,
    this.openInterestUsd,
    this.fundingRate,
    this.nextFundingTime,
    this.high24h,
    this.low24h,
  }) : super._();
  @override
  TickerResponseDto rebuild(void Function(TickerResponseDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  TickerResponseDtoBuilder toBuilder() =>
      TickerResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TickerResponseDto &&
        symbol == other.symbol &&
        exchange == other.exchange &&
        currentPrice == other.currentPrice &&
        indexPrice == other.indexPrice &&
        priceChangePercent24h == other.priceChangePercent24h &&
        volumeUsd == other.volumeUsd &&
        openInterestUsd == other.openInterestUsd &&
        fundingRate == other.fundingRate &&
        nextFundingTime == other.nextFundingTime &&
        high24h == other.high24h &&
        low24h == other.low24h;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, exchange.hashCode);
    _$hash = $jc(_$hash, currentPrice.hashCode);
    _$hash = $jc(_$hash, indexPrice.hashCode);
    _$hash = $jc(_$hash, priceChangePercent24h.hashCode);
    _$hash = $jc(_$hash, volumeUsd.hashCode);
    _$hash = $jc(_$hash, openInterestUsd.hashCode);
    _$hash = $jc(_$hash, fundingRate.hashCode);
    _$hash = $jc(_$hash, nextFundingTime.hashCode);
    _$hash = $jc(_$hash, high24h.hashCode);
    _$hash = $jc(_$hash, low24h.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TickerResponseDto')
          ..add('symbol', symbol)
          ..add('exchange', exchange)
          ..add('currentPrice', currentPrice)
          ..add('indexPrice', indexPrice)
          ..add('priceChangePercent24h', priceChangePercent24h)
          ..add('volumeUsd', volumeUsd)
          ..add('openInterestUsd', openInterestUsd)
          ..add('fundingRate', fundingRate)
          ..add('nextFundingTime', nextFundingTime)
          ..add('high24h', high24h)
          ..add('low24h', low24h))
        .toString();
  }
}

class TickerResponseDtoBuilder
    implements Builder<TickerResponseDto, TickerResponseDtoBuilder> {
  _$TickerResponseDto? _$v;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  String? _exchange;
  String? get exchange => _$this._exchange;
  set exchange(String? exchange) => _$this._exchange = exchange;

  String? _currentPrice;
  String? get currentPrice => _$this._currentPrice;
  set currentPrice(String? currentPrice) => _$this._currentPrice = currentPrice;

  String? _indexPrice;
  String? get indexPrice => _$this._indexPrice;
  set indexPrice(String? indexPrice) => _$this._indexPrice = indexPrice;

  String? _priceChangePercent24h;
  String? get priceChangePercent24h => _$this._priceChangePercent24h;
  set priceChangePercent24h(String? priceChangePercent24h) =>
      _$this._priceChangePercent24h = priceChangePercent24h;

  String? _volumeUsd;
  String? get volumeUsd => _$this._volumeUsd;
  set volumeUsd(String? volumeUsd) => _$this._volumeUsd = volumeUsd;

  String? _openInterestUsd;
  String? get openInterestUsd => _$this._openInterestUsd;
  set openInterestUsd(String? openInterestUsd) =>
      _$this._openInterestUsd = openInterestUsd;

  String? _fundingRate;
  String? get fundingRate => _$this._fundingRate;
  set fundingRate(String? fundingRate) => _$this._fundingRate = fundingRate;

  String? _nextFundingTime;
  String? get nextFundingTime => _$this._nextFundingTime;
  set nextFundingTime(String? nextFundingTime) =>
      _$this._nextFundingTime = nextFundingTime;

  String? _high24h;
  String? get high24h => _$this._high24h;
  set high24h(String? high24h) => _$this._high24h = high24h;

  String? _low24h;
  String? get low24h => _$this._low24h;
  set low24h(String? low24h) => _$this._low24h = low24h;

  TickerResponseDtoBuilder() {
    TickerResponseDto._defaults(this);
  }

  TickerResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _symbol = $v.symbol;
      _exchange = $v.exchange;
      _currentPrice = $v.currentPrice;
      _indexPrice = $v.indexPrice;
      _priceChangePercent24h = $v.priceChangePercent24h;
      _volumeUsd = $v.volumeUsd;
      _openInterestUsd = $v.openInterestUsd;
      _fundingRate = $v.fundingRate;
      _nextFundingTime = $v.nextFundingTime;
      _high24h = $v.high24h;
      _low24h = $v.low24h;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TickerResponseDto other) {
    _$v = other as _$TickerResponseDto;
  }

  @override
  void update(void Function(TickerResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TickerResponseDto build() => _build();

  _$TickerResponseDto _build() {
    final _$result =
        _$v ??
        _$TickerResponseDto._(
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'TickerResponseDto',
            'symbol',
          ),
          exchange: exchange,
          currentPrice: BuiltValueNullFieldError.checkNotNull(
            currentPrice,
            r'TickerResponseDto',
            'currentPrice',
          ),
          indexPrice: indexPrice,
          priceChangePercent24h: priceChangePercent24h,
          volumeUsd: BuiltValueNullFieldError.checkNotNull(
            volumeUsd,
            r'TickerResponseDto',
            'volumeUsd',
          ),
          openInterestUsd: openInterestUsd,
          fundingRate: fundingRate,
          nextFundingTime: nextFundingTime,
          high24h: high24h,
          low24h: low24h,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
