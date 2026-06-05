// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'trader_positions_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$TraderPositionsResponseDto extends TraderPositionsResponseDto {
  @override
  final BuiltList<PerpPositionDto> perp;
  @override
  final BuiltList<SpotBalanceDto> spot;

  factory _$TraderPositionsResponseDto([
    void Function(TraderPositionsResponseDtoBuilder)? updates,
  ]) => (TraderPositionsResponseDtoBuilder()..update(updates))._build();

  _$TraderPositionsResponseDto._({required this.perp, required this.spot})
    : super._();
  @override
  TraderPositionsResponseDto rebuild(
    void Function(TraderPositionsResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TraderPositionsResponseDtoBuilder toBuilder() =>
      TraderPositionsResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TraderPositionsResponseDto &&
        perp == other.perp &&
        spot == other.spot;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, perp.hashCode);
    _$hash = $jc(_$hash, spot.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TraderPositionsResponseDto')
          ..add('perp', perp)
          ..add('spot', spot))
        .toString();
  }
}

class TraderPositionsResponseDtoBuilder
    implements
        Builder<TraderPositionsResponseDto, TraderPositionsResponseDtoBuilder> {
  _$TraderPositionsResponseDto? _$v;

  ListBuilder<PerpPositionDto>? _perp;
  ListBuilder<PerpPositionDto> get perp =>
      _$this._perp ??= ListBuilder<PerpPositionDto>();
  set perp(ListBuilder<PerpPositionDto>? perp) => _$this._perp = perp;

  ListBuilder<SpotBalanceDto>? _spot;
  ListBuilder<SpotBalanceDto> get spot =>
      _$this._spot ??= ListBuilder<SpotBalanceDto>();
  set spot(ListBuilder<SpotBalanceDto>? spot) => _$this._spot = spot;

  TraderPositionsResponseDtoBuilder() {
    TraderPositionsResponseDto._defaults(this);
  }

  TraderPositionsResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _perp = $v.perp.toBuilder();
      _spot = $v.spot.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TraderPositionsResponseDto other) {
    _$v = other as _$TraderPositionsResponseDto;
  }

  @override
  void update(void Function(TraderPositionsResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TraderPositionsResponseDto build() => _build();

  _$TraderPositionsResponseDto _build() {
    _$TraderPositionsResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$TraderPositionsResponseDto._(
            perp: perp.build(),
            spot: spot.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'perp';
        perp.build();
        _$failedField = 'spot';
        spot.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'TraderPositionsResponseDto',
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
