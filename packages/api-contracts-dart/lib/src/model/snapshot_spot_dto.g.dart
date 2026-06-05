// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'snapshot_spot_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$SnapshotSpotDto extends SnapshotSpotDto {
  @override
  final num totalValue;
  @override
  final BuiltList<SpotBalanceItemDto> balances;

  factory _$SnapshotSpotDto([void Function(SnapshotSpotDtoBuilder)? updates]) =>
      (SnapshotSpotDtoBuilder()..update(updates))._build();

  _$SnapshotSpotDto._({required this.totalValue, required this.balances})
    : super._();
  @override
  SnapshotSpotDto rebuild(void Function(SnapshotSpotDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  SnapshotSpotDtoBuilder toBuilder() => SnapshotSpotDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is SnapshotSpotDto &&
        totalValue == other.totalValue &&
        balances == other.balances;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, totalValue.hashCode);
    _$hash = $jc(_$hash, balances.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'SnapshotSpotDto')
          ..add('totalValue', totalValue)
          ..add('balances', balances))
        .toString();
  }
}

class SnapshotSpotDtoBuilder
    implements Builder<SnapshotSpotDto, SnapshotSpotDtoBuilder> {
  _$SnapshotSpotDto? _$v;

  num? _totalValue;
  num? get totalValue => _$this._totalValue;
  set totalValue(num? totalValue) => _$this._totalValue = totalValue;

  ListBuilder<SpotBalanceItemDto>? _balances;
  ListBuilder<SpotBalanceItemDto> get balances =>
      _$this._balances ??= ListBuilder<SpotBalanceItemDto>();
  set balances(ListBuilder<SpotBalanceItemDto>? balances) =>
      _$this._balances = balances;

  SnapshotSpotDtoBuilder() {
    SnapshotSpotDto._defaults(this);
  }

  SnapshotSpotDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _totalValue = $v.totalValue;
      _balances = $v.balances.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(SnapshotSpotDto other) {
    _$v = other as _$SnapshotSpotDto;
  }

  @override
  void update(void Function(SnapshotSpotDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  SnapshotSpotDto build() => _build();

  _$SnapshotSpotDto _build() {
    _$SnapshotSpotDto _$result;
    try {
      _$result =
          _$v ??
          _$SnapshotSpotDto._(
            totalValue: BuiltValueNullFieldError.checkNotNull(
              totalValue,
              r'SnapshotSpotDto',
              'totalValue',
            ),
            balances: balances.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'balances';
        balances.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'SnapshotSpotDto',
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
