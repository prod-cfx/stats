// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_capabilities_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$BacktestingCapabilitiesResponseDto
    extends BacktestingCapabilitiesResponseDto {
  @override
  final BuiltList<String> allowedBaseTimeframes;

  factory _$BacktestingCapabilitiesResponseDto([
    void Function(BacktestingCapabilitiesResponseDtoBuilder)? updates,
  ]) => (BacktestingCapabilitiesResponseDtoBuilder()..update(updates))._build();

  _$BacktestingCapabilitiesResponseDto._({required this.allowedBaseTimeframes})
    : super._();
  @override
  BacktestingCapabilitiesResponseDto rebuild(
    void Function(BacktestingCapabilitiesResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingCapabilitiesResponseDtoBuilder toBuilder() =>
      BacktestingCapabilitiesResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingCapabilitiesResponseDto &&
        allowedBaseTimeframes == other.allowedBaseTimeframes;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, allowedBaseTimeframes.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'BacktestingCapabilitiesResponseDto',
    )..add('allowedBaseTimeframes', allowedBaseTimeframes)).toString();
  }
}

class BacktestingCapabilitiesResponseDtoBuilder
    implements
        Builder<
          BacktestingCapabilitiesResponseDto,
          BacktestingCapabilitiesResponseDtoBuilder
        > {
  _$BacktestingCapabilitiesResponseDto? _$v;

  ListBuilder<String>? _allowedBaseTimeframes;
  ListBuilder<String> get allowedBaseTimeframes =>
      _$this._allowedBaseTimeframes ??= ListBuilder<String>();
  set allowedBaseTimeframes(ListBuilder<String>? allowedBaseTimeframes) =>
      _$this._allowedBaseTimeframes = allowedBaseTimeframes;

  BacktestingCapabilitiesResponseDtoBuilder() {
    BacktestingCapabilitiesResponseDto._defaults(this);
  }

  BacktestingCapabilitiesResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _allowedBaseTimeframes = $v.allowedBaseTimeframes.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingCapabilitiesResponseDto other) {
    _$v = other as _$BacktestingCapabilitiesResponseDto;
  }

  @override
  void update(
    void Function(BacktestingCapabilitiesResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingCapabilitiesResponseDto build() => _build();

  _$BacktestingCapabilitiesResponseDto _build() {
    _$BacktestingCapabilitiesResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$BacktestingCapabilitiesResponseDto._(
            allowedBaseTimeframes: allowedBaseTimeframes.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'allowedBaseTimeframes';
        allowedBaseTimeframes.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'BacktestingCapabilitiesResponseDto',
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
