// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'aggregated_level_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AggregatedLevelDto extends AggregatedLevelDto {
  @override
  final num price;
  @override
  final num sizeTotal;
  @override
  final BuiltList<VenueDetailDto> details;

  factory _$AggregatedLevelDto([
    void Function(AggregatedLevelDtoBuilder)? updates,
  ]) => (AggregatedLevelDtoBuilder()..update(updates))._build();

  _$AggregatedLevelDto._({
    required this.price,
    required this.sizeTotal,
    required this.details,
  }) : super._();
  @override
  AggregatedLevelDto rebuild(
    void Function(AggregatedLevelDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AggregatedLevelDtoBuilder toBuilder() =>
      AggregatedLevelDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AggregatedLevelDto &&
        price == other.price &&
        sizeTotal == other.sizeTotal &&
        details == other.details;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, price.hashCode);
    _$hash = $jc(_$hash, sizeTotal.hashCode);
    _$hash = $jc(_$hash, details.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AggregatedLevelDto')
          ..add('price', price)
          ..add('sizeTotal', sizeTotal)
          ..add('details', details))
        .toString();
  }
}

class AggregatedLevelDtoBuilder
    implements Builder<AggregatedLevelDto, AggregatedLevelDtoBuilder> {
  _$AggregatedLevelDto? _$v;

  num? _price;
  num? get price => _$this._price;
  set price(num? price) => _$this._price = price;

  num? _sizeTotal;
  num? get sizeTotal => _$this._sizeTotal;
  set sizeTotal(num? sizeTotal) => _$this._sizeTotal = sizeTotal;

  ListBuilder<VenueDetailDto>? _details;
  ListBuilder<VenueDetailDto> get details =>
      _$this._details ??= ListBuilder<VenueDetailDto>();
  set details(ListBuilder<VenueDetailDto>? details) =>
      _$this._details = details;

  AggregatedLevelDtoBuilder() {
    AggregatedLevelDto._defaults(this);
  }

  AggregatedLevelDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _price = $v.price;
      _sizeTotal = $v.sizeTotal;
      _details = $v.details.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AggregatedLevelDto other) {
    _$v = other as _$AggregatedLevelDto;
  }

  @override
  void update(void Function(AggregatedLevelDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AggregatedLevelDto build() => _build();

  _$AggregatedLevelDto _build() {
    _$AggregatedLevelDto _$result;
    try {
      _$result =
          _$v ??
          _$AggregatedLevelDto._(
            price: BuiltValueNullFieldError.checkNotNull(
              price,
              r'AggregatedLevelDto',
              'price',
            ),
            sizeTotal: BuiltValueNullFieldError.checkNotNull(
              sizeTotal,
              r'AggregatedLevelDto',
              'sizeTotal',
            ),
            details: details.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'details';
        details.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AggregatedLevelDto',
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
