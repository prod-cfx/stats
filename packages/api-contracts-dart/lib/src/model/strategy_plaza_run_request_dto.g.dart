// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_run_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$StrategyPlazaRunRequestDto extends StrategyPlazaRunRequestDto {
  @override
  final String runRequestId;

  factory _$StrategyPlazaRunRequestDto([
    void Function(StrategyPlazaRunRequestDtoBuilder)? updates,
  ]) => (StrategyPlazaRunRequestDtoBuilder()..update(updates))._build();

  _$StrategyPlazaRunRequestDto._({required this.runRequestId}) : super._();
  @override
  StrategyPlazaRunRequestDto rebuild(
    void Function(StrategyPlazaRunRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaRunRequestDtoBuilder toBuilder() =>
      StrategyPlazaRunRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaRunRequestDto &&
        runRequestId == other.runRequestId;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, runRequestId.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'StrategyPlazaRunRequestDto',
    )..add('runRequestId', runRequestId)).toString();
  }
}

class StrategyPlazaRunRequestDtoBuilder
    implements
        Builder<StrategyPlazaRunRequestDto, StrategyPlazaRunRequestDtoBuilder> {
  _$StrategyPlazaRunRequestDto? _$v;

  String? _runRequestId;
  String? get runRequestId => _$this._runRequestId;
  set runRequestId(String? runRequestId) => _$this._runRequestId = runRequestId;

  StrategyPlazaRunRequestDtoBuilder() {
    StrategyPlazaRunRequestDto._defaults(this);
  }

  StrategyPlazaRunRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _runRequestId = $v.runRequestId;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaRunRequestDto other) {
    _$v = other as _$StrategyPlazaRunRequestDto;
  }

  @override
  void update(void Function(StrategyPlazaRunRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaRunRequestDto build() => _build();

  _$StrategyPlazaRunRequestDto _build() {
    final _$result =
        _$v ??
        _$StrategyPlazaRunRequestDto._(
          runRequestId: BuiltValueNullFieldError.checkNotNull(
            runRequestId,
            r'StrategyPlazaRunRequestDto',
            'runRequestId',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
