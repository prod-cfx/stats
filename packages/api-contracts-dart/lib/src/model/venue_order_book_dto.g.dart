// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'venue_order_book_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$VenueOrderBookDto extends VenueOrderBookDto {
  @override
  final String venueId;
  @override
  final String marketKey;
  @override
  final BuiltList<OrderBookLevelDto> bids;
  @override
  final BuiltList<OrderBookLevelDto> asks;
  @override
  final num? exchangeTs;
  @override
  final num receivedTs;
  @override
  final num version;

  factory _$VenueOrderBookDto([
    void Function(VenueOrderBookDtoBuilder)? updates,
  ]) => (VenueOrderBookDtoBuilder()..update(updates))._build();

  _$VenueOrderBookDto._({
    required this.venueId,
    required this.marketKey,
    required this.bids,
    required this.asks,
    this.exchangeTs,
    required this.receivedTs,
    required this.version,
  }) : super._();
  @override
  VenueOrderBookDto rebuild(void Function(VenueOrderBookDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  VenueOrderBookDtoBuilder toBuilder() =>
      VenueOrderBookDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is VenueOrderBookDto &&
        venueId == other.venueId &&
        marketKey == other.marketKey &&
        bids == other.bids &&
        asks == other.asks &&
        exchangeTs == other.exchangeTs &&
        receivedTs == other.receivedTs &&
        version == other.version;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, venueId.hashCode);
    _$hash = $jc(_$hash, marketKey.hashCode);
    _$hash = $jc(_$hash, bids.hashCode);
    _$hash = $jc(_$hash, asks.hashCode);
    _$hash = $jc(_$hash, exchangeTs.hashCode);
    _$hash = $jc(_$hash, receivedTs.hashCode);
    _$hash = $jc(_$hash, version.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'VenueOrderBookDto')
          ..add('venueId', venueId)
          ..add('marketKey', marketKey)
          ..add('bids', bids)
          ..add('asks', asks)
          ..add('exchangeTs', exchangeTs)
          ..add('receivedTs', receivedTs)
          ..add('version', version))
        .toString();
  }
}

class VenueOrderBookDtoBuilder
    implements Builder<VenueOrderBookDto, VenueOrderBookDtoBuilder> {
  _$VenueOrderBookDto? _$v;

  String? _venueId;
  String? get venueId => _$this._venueId;
  set venueId(String? venueId) => _$this._venueId = venueId;

  String? _marketKey;
  String? get marketKey => _$this._marketKey;
  set marketKey(String? marketKey) => _$this._marketKey = marketKey;

  ListBuilder<OrderBookLevelDto>? _bids;
  ListBuilder<OrderBookLevelDto> get bids =>
      _$this._bids ??= ListBuilder<OrderBookLevelDto>();
  set bids(ListBuilder<OrderBookLevelDto>? bids) => _$this._bids = bids;

  ListBuilder<OrderBookLevelDto>? _asks;
  ListBuilder<OrderBookLevelDto> get asks =>
      _$this._asks ??= ListBuilder<OrderBookLevelDto>();
  set asks(ListBuilder<OrderBookLevelDto>? asks) => _$this._asks = asks;

  num? _exchangeTs;
  num? get exchangeTs => _$this._exchangeTs;
  set exchangeTs(num? exchangeTs) => _$this._exchangeTs = exchangeTs;

  num? _receivedTs;
  num? get receivedTs => _$this._receivedTs;
  set receivedTs(num? receivedTs) => _$this._receivedTs = receivedTs;

  num? _version;
  num? get version => _$this._version;
  set version(num? version) => _$this._version = version;

  VenueOrderBookDtoBuilder() {
    VenueOrderBookDto._defaults(this);
  }

  VenueOrderBookDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _venueId = $v.venueId;
      _marketKey = $v.marketKey;
      _bids = $v.bids.toBuilder();
      _asks = $v.asks.toBuilder();
      _exchangeTs = $v.exchangeTs;
      _receivedTs = $v.receivedTs;
      _version = $v.version;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(VenueOrderBookDto other) {
    _$v = other as _$VenueOrderBookDto;
  }

  @override
  void update(void Function(VenueOrderBookDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  VenueOrderBookDto build() => _build();

  _$VenueOrderBookDto _build() {
    _$VenueOrderBookDto _$result;
    try {
      _$result =
          _$v ??
          _$VenueOrderBookDto._(
            venueId: BuiltValueNullFieldError.checkNotNull(
              venueId,
              r'VenueOrderBookDto',
              'venueId',
            ),
            marketKey: BuiltValueNullFieldError.checkNotNull(
              marketKey,
              r'VenueOrderBookDto',
              'marketKey',
            ),
            bids: bids.build(),
            asks: asks.build(),
            exchangeTs: exchangeTs,
            receivedTs: BuiltValueNullFieldError.checkNotNull(
              receivedTs,
              r'VenueOrderBookDto',
              'receivedTs',
            ),
            version: BuiltValueNullFieldError.checkNotNull(
              version,
              r'VenueOrderBookDto',
              'version',
            ),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'bids';
        bids.build();
        _$failedField = 'asks';
        asks.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'VenueOrderBookDto',
          _$failedField,
          e.toString(),
        );
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
