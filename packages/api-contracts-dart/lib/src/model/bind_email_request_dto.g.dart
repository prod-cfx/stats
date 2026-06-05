// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bind_email_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$BindEmailRequestDto extends BindEmailRequestDto {
  @override
  final String email;
  @override
  final String code;

  factory _$BindEmailRequestDto([
    void Function(BindEmailRequestDtoBuilder)? updates,
  ]) => (BindEmailRequestDtoBuilder()..update(updates))._build();

  _$BindEmailRequestDto._({required this.email, required this.code})
    : super._();
  @override
  BindEmailRequestDto rebuild(
    void Function(BindEmailRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BindEmailRequestDtoBuilder toBuilder() =>
      BindEmailRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BindEmailRequestDto &&
        email == other.email &&
        code == other.code;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'BindEmailRequestDto')
          ..add('email', email)
          ..add('code', code))
        .toString();
  }
}

class BindEmailRequestDtoBuilder
    implements Builder<BindEmailRequestDto, BindEmailRequestDtoBuilder> {
  _$BindEmailRequestDto? _$v;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  String? _code;
  String? get code => _$this._code;
  set code(String? code) => _$this._code = code;

  BindEmailRequestDtoBuilder() {
    BindEmailRequestDto._defaults(this);
  }

  BindEmailRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _email = $v.email;
      _code = $v.code;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BindEmailRequestDto other) {
    _$v = other as _$BindEmailRequestDto;
  }

  @override
  void update(void Function(BindEmailRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  BindEmailRequestDto build() => _build();

  _$BindEmailRequestDto _build() {
    final _$result =
        _$v ??
        _$BindEmailRequestDto._(
          email: BuiltValueNullFieldError.checkNotNull(
            email,
            r'BindEmailRequestDto',
            'email',
          ),
          code: BuiltValueNullFieldError.checkNotNull(
            code,
            r'BindEmailRequestDto',
            'code',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
