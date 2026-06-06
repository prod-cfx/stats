// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'aggregated_volume_snapshot_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AggregatedVolumeSnapshotResponseDto
    extends AggregatedVolumeSnapshotResponseDto {
  @override
  final String symbol;
  @override
  final num total;
  @override
  final BuiltList<AggregatedVolumeRowDto> rows;

  factory _$AggregatedVolumeSnapshotResponseDto([
    void Function(AggregatedVolumeSnapshotResponseDtoBuilder)? updates,
  ]) =>
      (AggregatedVolumeSnapshotResponseDtoBuilder()..update(updates))._build();

  _$AggregatedVolumeSnapshotResponseDto._({
    required this.symbol,
    required this.total,
    required this.rows,
  }) : super._();
  @override
  AggregatedVolumeSnapshotResponseDto rebuild(
    void Function(AggregatedVolumeSnapshotResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AggregatedVolumeSnapshotResponseDtoBuilder toBuilder() =>
      AggregatedVolumeSnapshotResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AggregatedVolumeSnapshotResponseDto &&
        symbol == other.symbol &&
        total == other.total &&
        rows == other.rows;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, total.hashCode);
    _$hash = $jc(_$hash, rows.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AggregatedVolumeSnapshotResponseDto')
          ..add('symbol', symbol)
          ..add('total', total)
          ..add('rows', rows))
        .toString();
  }
}

class AggregatedVolumeSnapshotResponseDtoBuilder
    implements
        Builder<
          AggregatedVolumeSnapshotResponseDto,
          AggregatedVolumeSnapshotResponseDtoBuilder
        > {
  _$AggregatedVolumeSnapshotResponseDto? _$v;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  num? _total;
  num? get total => _$this._total;
  set total(num? total) => _$this._total = total;

  ListBuilder<AggregatedVolumeRowDto>? _rows;
  ListBuilder<AggregatedVolumeRowDto> get rows =>
      _$this._rows ??= ListBuilder<AggregatedVolumeRowDto>();
  set rows(ListBuilder<AggregatedVolumeRowDto>? rows) => _$this._rows = rows;

  AggregatedVolumeSnapshotResponseDtoBuilder() {
    AggregatedVolumeSnapshotResponseDto._defaults(this);
  }

  AggregatedVolumeSnapshotResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _symbol = $v.symbol;
      _total = $v.total;
      _rows = $v.rows.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AggregatedVolumeSnapshotResponseDto other) {
    _$v = other as _$AggregatedVolumeSnapshotResponseDto;
  }

  @override
  void update(
    void Function(AggregatedVolumeSnapshotResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AggregatedVolumeSnapshotResponseDto build() => _build();

  _$AggregatedVolumeSnapshotResponseDto _build() {
    _$AggregatedVolumeSnapshotResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$AggregatedVolumeSnapshotResponseDto._(
            symbol: BuiltValueNullFieldError.checkNotNull(
              symbol,
              r'AggregatedVolumeSnapshotResponseDto',
              'symbol',
            ),
            total: BuiltValueNullFieldError.checkNotNull(
              total,
              r'AggregatedVolumeSnapshotResponseDto',
              'total',
            ),
            rows: rows.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'rows';
        rows.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AggregatedVolumeSnapshotResponseDto',
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
