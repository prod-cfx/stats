// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'exchange_long_short_ratio_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$ExchangeLongShortRatioResponseDto
    extends ExchangeLongShortRatioResponseDto {
  @override
  final num rank;
  @override
  final String name;
  @override
  final String? logoUrl;
  @override
  final num longPercent;
  @override
  final num shortPercent;
  @override
  final num longAmountUsd;
  @override
  final num shortAmountUsd;

  factory _$ExchangeLongShortRatioResponseDto([
    void Function(ExchangeLongShortRatioResponseDtoBuilder)? updates,
  ]) => (ExchangeLongShortRatioResponseDtoBuilder()..update(updates))._build();

  _$ExchangeLongShortRatioResponseDto._({
    required this.rank,
    required this.name,
    this.logoUrl,
    required this.longPercent,
    required this.shortPercent,
    required this.longAmountUsd,
    required this.shortAmountUsd,
  }) : super._();
  @override
  ExchangeLongShortRatioResponseDto rebuild(
    void Function(ExchangeLongShortRatioResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  ExchangeLongShortRatioResponseDtoBuilder toBuilder() =>
      ExchangeLongShortRatioResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is ExchangeLongShortRatioResponseDto &&
        rank == other.rank &&
        name == other.name &&
        logoUrl == other.logoUrl &&
        longPercent == other.longPercent &&
        shortPercent == other.shortPercent &&
        longAmountUsd == other.longAmountUsd &&
        shortAmountUsd == other.shortAmountUsd;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, rank.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, logoUrl.hashCode);
    _$hash = $jc(_$hash, longPercent.hashCode);
    _$hash = $jc(_$hash, shortPercent.hashCode);
    _$hash = $jc(_$hash, longAmountUsd.hashCode);
    _$hash = $jc(_$hash, shortAmountUsd.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'ExchangeLongShortRatioResponseDto')
          ..add('rank', rank)
          ..add('name', name)
          ..add('logoUrl', logoUrl)
          ..add('longPercent', longPercent)
          ..add('shortPercent', shortPercent)
          ..add('longAmountUsd', longAmountUsd)
          ..add('shortAmountUsd', shortAmountUsd))
        .toString();
  }
}

class ExchangeLongShortRatioResponseDtoBuilder
    implements
        Builder<
          ExchangeLongShortRatioResponseDto,
          ExchangeLongShortRatioResponseDtoBuilder
        > {
  _$ExchangeLongShortRatioResponseDto? _$v;

  num? _rank;
  num? get rank => _$this._rank;
  set rank(num? rank) => _$this._rank = rank;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _logoUrl;
  String? get logoUrl => _$this._logoUrl;
  set logoUrl(String? logoUrl) => _$this._logoUrl = logoUrl;

  num? _longPercent;
  num? get longPercent => _$this._longPercent;
  set longPercent(num? longPercent) => _$this._longPercent = longPercent;

  num? _shortPercent;
  num? get shortPercent => _$this._shortPercent;
  set shortPercent(num? shortPercent) => _$this._shortPercent = shortPercent;

  num? _longAmountUsd;
  num? get longAmountUsd => _$this._longAmountUsd;
  set longAmountUsd(num? longAmountUsd) =>
      _$this._longAmountUsd = longAmountUsd;

  num? _shortAmountUsd;
  num? get shortAmountUsd => _$this._shortAmountUsd;
  set shortAmountUsd(num? shortAmountUsd) =>
      _$this._shortAmountUsd = shortAmountUsd;

  ExchangeLongShortRatioResponseDtoBuilder() {
    ExchangeLongShortRatioResponseDto._defaults(this);
  }

  ExchangeLongShortRatioResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _rank = $v.rank;
      _name = $v.name;
      _logoUrl = $v.logoUrl;
      _longPercent = $v.longPercent;
      _shortPercent = $v.shortPercent;
      _longAmountUsd = $v.longAmountUsd;
      _shortAmountUsd = $v.shortAmountUsd;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(ExchangeLongShortRatioResponseDto other) {
    _$v = other as _$ExchangeLongShortRatioResponseDto;
  }

  @override
  void update(
    void Function(ExchangeLongShortRatioResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  ExchangeLongShortRatioResponseDto build() => _build();

  _$ExchangeLongShortRatioResponseDto _build() {
    final _$result =
        _$v ??
        _$ExchangeLongShortRatioResponseDto._(
          rank: BuiltValueNullFieldError.checkNotNull(
            rank,
            r'ExchangeLongShortRatioResponseDto',
            'rank',
          ),
          name: BuiltValueNullFieldError.checkNotNull(
            name,
            r'ExchangeLongShortRatioResponseDto',
            'name',
          ),
          logoUrl: logoUrl,
          longPercent: BuiltValueNullFieldError.checkNotNull(
            longPercent,
            r'ExchangeLongShortRatioResponseDto',
            'longPercent',
          ),
          shortPercent: BuiltValueNullFieldError.checkNotNull(
            shortPercent,
            r'ExchangeLongShortRatioResponseDto',
            'shortPercent',
          ),
          longAmountUsd: BuiltValueNullFieldError.checkNotNull(
            longAmountUsd,
            r'ExchangeLongShortRatioResponseDto',
            'longAmountUsd',
          ),
          shortAmountUsd: BuiltValueNullFieldError.checkNotNull(
            shortAmountUsd,
            r'ExchangeLongShortRatioResponseDto',
            'shortAmountUsd',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
