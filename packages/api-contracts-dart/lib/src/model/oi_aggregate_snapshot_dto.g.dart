// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'oi_aggregate_snapshot_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OiAggregateSnapshotDto extends OiAggregateSnapshotDto {
  @override
  final String symbol;
  @override
  final String dataTimestamp;
  @override
  final OiAggregateTotalDto total;
  @override
  final BuiltList<OiAggregateRowDto> rows;

  factory _$OiAggregateSnapshotDto([
    void Function(OiAggregateSnapshotDtoBuilder)? updates,
  ]) => (OiAggregateSnapshotDtoBuilder()..update(updates))._build();

  _$OiAggregateSnapshotDto._({
    required this.symbol,
    required this.dataTimestamp,
    required this.total,
    required this.rows,
  }) : super._();
  @override
  OiAggregateSnapshotDto rebuild(
    void Function(OiAggregateSnapshotDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  OiAggregateSnapshotDtoBuilder toBuilder() =>
      OiAggregateSnapshotDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OiAggregateSnapshotDto &&
        symbol == other.symbol &&
        dataTimestamp == other.dataTimestamp &&
        total == other.total &&
        rows == other.rows;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, dataTimestamp.hashCode);
    _$hash = $jc(_$hash, total.hashCode);
    _$hash = $jc(_$hash, rows.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OiAggregateSnapshotDto')
          ..add('symbol', symbol)
          ..add('dataTimestamp', dataTimestamp)
          ..add('total', total)
          ..add('rows', rows))
        .toString();
  }
}

class OiAggregateSnapshotDtoBuilder
    implements Builder<OiAggregateSnapshotDto, OiAggregateSnapshotDtoBuilder> {
  _$OiAggregateSnapshotDto? _$v;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  String? _dataTimestamp;
  String? get dataTimestamp => _$this._dataTimestamp;
  set dataTimestamp(String? dataTimestamp) =>
      _$this._dataTimestamp = dataTimestamp;

  OiAggregateTotalDtoBuilder? _total;
  OiAggregateTotalDtoBuilder get total =>
      _$this._total ??= OiAggregateTotalDtoBuilder();
  set total(OiAggregateTotalDtoBuilder? total) => _$this._total = total;

  ListBuilder<OiAggregateRowDto>? _rows;
  ListBuilder<OiAggregateRowDto> get rows =>
      _$this._rows ??= ListBuilder<OiAggregateRowDto>();
  set rows(ListBuilder<OiAggregateRowDto>? rows) => _$this._rows = rows;

  OiAggregateSnapshotDtoBuilder() {
    OiAggregateSnapshotDto._defaults(this);
  }

  OiAggregateSnapshotDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _symbol = $v.symbol;
      _dataTimestamp = $v.dataTimestamp;
      _total = $v.total.toBuilder();
      _rows = $v.rows.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OiAggregateSnapshotDto other) {
    _$v = other as _$OiAggregateSnapshotDto;
  }

  @override
  void update(void Function(OiAggregateSnapshotDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OiAggregateSnapshotDto build() => _build();

  _$OiAggregateSnapshotDto _build() {
    _$OiAggregateSnapshotDto _$result;
    try {
      _$result =
          _$v ??
          _$OiAggregateSnapshotDto._(
            symbol: BuiltValueNullFieldError.checkNotNull(
              symbol,
              r'OiAggregateSnapshotDto',
              'symbol',
            ),
            dataTimestamp: BuiltValueNullFieldError.checkNotNull(
              dataTimestamp,
              r'OiAggregateSnapshotDto',
              'dataTimestamp',
            ),
            total: total.build(),
            rows: rows.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'total';
        total.build();
        _$failedField = 'rows';
        rows.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'OiAggregateSnapshotDto',
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
