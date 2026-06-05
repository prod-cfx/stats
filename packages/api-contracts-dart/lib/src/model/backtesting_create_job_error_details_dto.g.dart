// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_create_job_error_details_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$BacktestingCreateJobErrorDetailsDto
    extends BacktestingCreateJobErrorDetailsDto {
  @override
  final String? code;
  @override
  final String message;
  @override
  final BuiltMap<String, JsonObject?>? args;

  factory _$BacktestingCreateJobErrorDetailsDto([
    void Function(BacktestingCreateJobErrorDetailsDtoBuilder)? updates,
  ]) =>
      (BacktestingCreateJobErrorDetailsDtoBuilder()..update(updates))._build();

  _$BacktestingCreateJobErrorDetailsDto._({
    this.code,
    required this.message,
    this.args,
  }) : super._();
  @override
  BacktestingCreateJobErrorDetailsDto rebuild(
    void Function(BacktestingCreateJobErrorDetailsDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingCreateJobErrorDetailsDtoBuilder toBuilder() =>
      BacktestingCreateJobErrorDetailsDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingCreateJobErrorDetailsDto &&
        code == other.code &&
        message == other.message &&
        args == other.args;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jc(_$hash, message.hashCode);
    _$hash = $jc(_$hash, args.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'BacktestingCreateJobErrorDetailsDto')
          ..add('code', code)
          ..add('message', message)
          ..add('args', args))
        .toString();
  }
}

class BacktestingCreateJobErrorDetailsDtoBuilder
    implements
        Builder<
          BacktestingCreateJobErrorDetailsDto,
          BacktestingCreateJobErrorDetailsDtoBuilder
        > {
  _$BacktestingCreateJobErrorDetailsDto? _$v;

  String? _code;
  String? get code => _$this._code;
  set code(String? code) => _$this._code = code;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  MapBuilder<String, JsonObject?>? _args;
  MapBuilder<String, JsonObject?> get args =>
      _$this._args ??= MapBuilder<String, JsonObject?>();
  set args(MapBuilder<String, JsonObject?>? args) => _$this._args = args;

  BacktestingCreateJobErrorDetailsDtoBuilder() {
    BacktestingCreateJobErrorDetailsDto._defaults(this);
  }

  BacktestingCreateJobErrorDetailsDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _code = $v.code;
      _message = $v.message;
      _args = $v.args?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingCreateJobErrorDetailsDto other) {
    _$v = other as _$BacktestingCreateJobErrorDetailsDto;
  }

  @override
  void update(
    void Function(BacktestingCreateJobErrorDetailsDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingCreateJobErrorDetailsDto build() => _build();

  _$BacktestingCreateJobErrorDetailsDto _build() {
    _$BacktestingCreateJobErrorDetailsDto _$result;
    try {
      _$result =
          _$v ??
          _$BacktestingCreateJobErrorDetailsDto._(
            code: code,
            message: BuiltValueNullFieldError.checkNotNull(
              message,
              r'BacktestingCreateJobErrorDetailsDto',
              'message',
            ),
            args: _args?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'args';
        _args?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'BacktestingCreateJobErrorDetailsDto',
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
