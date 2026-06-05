// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_create_job_range_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$BacktestingCreateJobRangeDto extends BacktestingCreateJobRangeDto {
  @override
  final num fromTs;
  @override
  final num toTs;

  factory _$BacktestingCreateJobRangeDto([
    void Function(BacktestingCreateJobRangeDtoBuilder)? updates,
  ]) => (BacktestingCreateJobRangeDtoBuilder()..update(updates))._build();

  _$BacktestingCreateJobRangeDto._({required this.fromTs, required this.toTs})
    : super._();
  @override
  BacktestingCreateJobRangeDto rebuild(
    void Function(BacktestingCreateJobRangeDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingCreateJobRangeDtoBuilder toBuilder() =>
      BacktestingCreateJobRangeDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingCreateJobRangeDto &&
        fromTs == other.fromTs &&
        toTs == other.toTs;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, fromTs.hashCode);
    _$hash = $jc(_$hash, toTs.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'BacktestingCreateJobRangeDto')
          ..add('fromTs', fromTs)
          ..add('toTs', toTs))
        .toString();
  }
}

class BacktestingCreateJobRangeDtoBuilder
    implements
        Builder<
          BacktestingCreateJobRangeDto,
          BacktestingCreateJobRangeDtoBuilder
        > {
  _$BacktestingCreateJobRangeDto? _$v;

  num? _fromTs;
  num? get fromTs => _$this._fromTs;
  set fromTs(num? fromTs) => _$this._fromTs = fromTs;

  num? _toTs;
  num? get toTs => _$this._toTs;
  set toTs(num? toTs) => _$this._toTs = toTs;

  BacktestingCreateJobRangeDtoBuilder() {
    BacktestingCreateJobRangeDto._defaults(this);
  }

  BacktestingCreateJobRangeDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _fromTs = $v.fromTs;
      _toTs = $v.toTs;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingCreateJobRangeDto other) {
    _$v = other as _$BacktestingCreateJobRangeDto;
  }

  @override
  void update(void Function(BacktestingCreateJobRangeDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingCreateJobRangeDto build() => _build();

  _$BacktestingCreateJobRangeDto _build() {
    final _$result =
        _$v ??
        _$BacktestingCreateJobRangeDto._(
          fromTs: BuiltValueNullFieldError.checkNotNull(
            fromTs,
            r'BacktestingCreateJobRangeDto',
            'fromTs',
          ),
          toTs: BuiltValueNullFieldError.checkNotNull(
            toTs,
            r'BacktestingCreateJobRangeDto',
            'toTs',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
