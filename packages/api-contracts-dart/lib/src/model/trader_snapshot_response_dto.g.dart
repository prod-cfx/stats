// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'trader_snapshot_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$TraderSnapshotResponseDto extends TraderSnapshotResponseDto {
  @override
  final SnapshotPerpDto perp;
  @override
  final SnapshotSpotDto spot;
  @override
  final SnapshotTotalDto total;

  factory _$TraderSnapshotResponseDto([
    void Function(TraderSnapshotResponseDtoBuilder)? updates,
  ]) => (TraderSnapshotResponseDtoBuilder()..update(updates))._build();

  _$TraderSnapshotResponseDto._({
    required this.perp,
    required this.spot,
    required this.total,
  }) : super._();
  @override
  TraderSnapshotResponseDto rebuild(
    void Function(TraderSnapshotResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TraderSnapshotResponseDtoBuilder toBuilder() =>
      TraderSnapshotResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TraderSnapshotResponseDto &&
        perp == other.perp &&
        spot == other.spot &&
        total == other.total;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, perp.hashCode);
    _$hash = $jc(_$hash, spot.hashCode);
    _$hash = $jc(_$hash, total.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TraderSnapshotResponseDto')
          ..add('perp', perp)
          ..add('spot', spot)
          ..add('total', total))
        .toString();
  }
}

class TraderSnapshotResponseDtoBuilder
    implements
        Builder<TraderSnapshotResponseDto, TraderSnapshotResponseDtoBuilder> {
  _$TraderSnapshotResponseDto? _$v;

  SnapshotPerpDtoBuilder? _perp;
  SnapshotPerpDtoBuilder get perp => _$this._perp ??= SnapshotPerpDtoBuilder();
  set perp(SnapshotPerpDtoBuilder? perp) => _$this._perp = perp;

  SnapshotSpotDtoBuilder? _spot;
  SnapshotSpotDtoBuilder get spot => _$this._spot ??= SnapshotSpotDtoBuilder();
  set spot(SnapshotSpotDtoBuilder? spot) => _$this._spot = spot;

  SnapshotTotalDtoBuilder? _total;
  SnapshotTotalDtoBuilder get total =>
      _$this._total ??= SnapshotTotalDtoBuilder();
  set total(SnapshotTotalDtoBuilder? total) => _$this._total = total;

  TraderSnapshotResponseDtoBuilder() {
    TraderSnapshotResponseDto._defaults(this);
  }

  TraderSnapshotResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _perp = $v.perp.toBuilder();
      _spot = $v.spot.toBuilder();
      _total = $v.total.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TraderSnapshotResponseDto other) {
    _$v = other as _$TraderSnapshotResponseDto;
  }

  @override
  void update(void Function(TraderSnapshotResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TraderSnapshotResponseDto build() => _build();

  _$TraderSnapshotResponseDto _build() {
    _$TraderSnapshotResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$TraderSnapshotResponseDto._(
            perp: perp.build(),
            spot: spot.build(),
            total: total.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'perp';
        perp.build();
        _$failedField = 'spot';
        spot.build();
        _$failedField = 'total';
        total.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'TraderSnapshotResponseDto',
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
