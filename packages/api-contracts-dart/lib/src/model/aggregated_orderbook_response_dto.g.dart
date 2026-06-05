// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'aggregated_orderbook_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AggregatedOrderbookResponseDto extends AggregatedOrderbookResponseDto {
  @override
  final String marketKey;
  @override
  final String base_;
  @override
  final String type;
  @override
  final BuiltList<AggregatedLevelDto> asks;
  @override
  final BuiltList<AggregatedLevelDto> bids;
  @override
  final num midPrice;
  @override
  final num updatedAt;
  @override
  final BuiltList<String> venues;
  @override
  final BuiltList<String> mergedQuotes;

  factory _$AggregatedOrderbookResponseDto([
    void Function(AggregatedOrderbookResponseDtoBuilder)? updates,
  ]) => (AggregatedOrderbookResponseDtoBuilder()..update(updates))._build();

  _$AggregatedOrderbookResponseDto._({
    required this.marketKey,
    required this.base_,
    required this.type,
    required this.asks,
    required this.bids,
    required this.midPrice,
    required this.updatedAt,
    required this.venues,
    required this.mergedQuotes,
  }) : super._();
  @override
  AggregatedOrderbookResponseDto rebuild(
    void Function(AggregatedOrderbookResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AggregatedOrderbookResponseDtoBuilder toBuilder() =>
      AggregatedOrderbookResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AggregatedOrderbookResponseDto &&
        marketKey == other.marketKey &&
        base_ == other.base_ &&
        type == other.type &&
        asks == other.asks &&
        bids == other.bids &&
        midPrice == other.midPrice &&
        updatedAt == other.updatedAt &&
        venues == other.venues &&
        mergedQuotes == other.mergedQuotes;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, marketKey.hashCode);
    _$hash = $jc(_$hash, base_.hashCode);
    _$hash = $jc(_$hash, type.hashCode);
    _$hash = $jc(_$hash, asks.hashCode);
    _$hash = $jc(_$hash, bids.hashCode);
    _$hash = $jc(_$hash, midPrice.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jc(_$hash, venues.hashCode);
    _$hash = $jc(_$hash, mergedQuotes.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AggregatedOrderbookResponseDto')
          ..add('marketKey', marketKey)
          ..add('base_', base_)
          ..add('type', type)
          ..add('asks', asks)
          ..add('bids', bids)
          ..add('midPrice', midPrice)
          ..add('updatedAt', updatedAt)
          ..add('venues', venues)
          ..add('mergedQuotes', mergedQuotes))
        .toString();
  }
}

class AggregatedOrderbookResponseDtoBuilder
    implements
        Builder<
          AggregatedOrderbookResponseDto,
          AggregatedOrderbookResponseDtoBuilder
        > {
  _$AggregatedOrderbookResponseDto? _$v;

  String? _marketKey;
  String? get marketKey => _$this._marketKey;
  set marketKey(String? marketKey) => _$this._marketKey = marketKey;

  String? _base_;
  String? get base_ => _$this._base_;
  set base_(String? base_) => _$this._base_ = base_;

  String? _type;
  String? get type => _$this._type;
  set type(String? type) => _$this._type = type;

  ListBuilder<AggregatedLevelDto>? _asks;
  ListBuilder<AggregatedLevelDto> get asks =>
      _$this._asks ??= ListBuilder<AggregatedLevelDto>();
  set asks(ListBuilder<AggregatedLevelDto>? asks) => _$this._asks = asks;

  ListBuilder<AggregatedLevelDto>? _bids;
  ListBuilder<AggregatedLevelDto> get bids =>
      _$this._bids ??= ListBuilder<AggregatedLevelDto>();
  set bids(ListBuilder<AggregatedLevelDto>? bids) => _$this._bids = bids;

  num? _midPrice;
  num? get midPrice => _$this._midPrice;
  set midPrice(num? midPrice) => _$this._midPrice = midPrice;

  num? _updatedAt;
  num? get updatedAt => _$this._updatedAt;
  set updatedAt(num? updatedAt) => _$this._updatedAt = updatedAt;

  ListBuilder<String>? _venues;
  ListBuilder<String> get venues => _$this._venues ??= ListBuilder<String>();
  set venues(ListBuilder<String>? venues) => _$this._venues = venues;

  ListBuilder<String>? _mergedQuotes;
  ListBuilder<String> get mergedQuotes =>
      _$this._mergedQuotes ??= ListBuilder<String>();
  set mergedQuotes(ListBuilder<String>? mergedQuotes) =>
      _$this._mergedQuotes = mergedQuotes;

  AggregatedOrderbookResponseDtoBuilder() {
    AggregatedOrderbookResponseDto._defaults(this);
  }

  AggregatedOrderbookResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _marketKey = $v.marketKey;
      _base_ = $v.base_;
      _type = $v.type;
      _asks = $v.asks.toBuilder();
      _bids = $v.bids.toBuilder();
      _midPrice = $v.midPrice;
      _updatedAt = $v.updatedAt;
      _venues = $v.venues.toBuilder();
      _mergedQuotes = $v.mergedQuotes.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AggregatedOrderbookResponseDto other) {
    _$v = other as _$AggregatedOrderbookResponseDto;
  }

  @override
  void update(void Function(AggregatedOrderbookResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AggregatedOrderbookResponseDto build() => _build();

  _$AggregatedOrderbookResponseDto _build() {
    _$AggregatedOrderbookResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$AggregatedOrderbookResponseDto._(
            marketKey: BuiltValueNullFieldError.checkNotNull(
              marketKey,
              r'AggregatedOrderbookResponseDto',
              'marketKey',
            ),
            base_: BuiltValueNullFieldError.checkNotNull(
              base_,
              r'AggregatedOrderbookResponseDto',
              'base_',
            ),
            type: BuiltValueNullFieldError.checkNotNull(
              type,
              r'AggregatedOrderbookResponseDto',
              'type',
            ),
            asks: asks.build(),
            bids: bids.build(),
            midPrice: BuiltValueNullFieldError.checkNotNull(
              midPrice,
              r'AggregatedOrderbookResponseDto',
              'midPrice',
            ),
            updatedAt: BuiltValueNullFieldError.checkNotNull(
              updatedAt,
              r'AggregatedOrderbookResponseDto',
              'updatedAt',
            ),
            venues: venues.build(),
            mergedQuotes: mergedQuotes.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'asks';
        asks.build();
        _$failedField = 'bids';
        bids.build();

        _$failedField = 'venues';
        venues.build();
        _$failedField = 'mergedQuotes';
        mergedQuotes.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AggregatedOrderbookResponseDto',
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
