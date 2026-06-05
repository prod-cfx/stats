// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'login_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$LoginRequestDto extends LoginRequestDto {
  @override
  final String email;
  @override
  final String password;

  factory _$LoginRequestDto([void Function(LoginRequestDtoBuilder)? updates]) =>
      (LoginRequestDtoBuilder()..update(updates))._build();

  _$LoginRequestDto._({required this.email, required this.password})
    : super._();
  @override
  LoginRequestDto rebuild(void Function(LoginRequestDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  LoginRequestDtoBuilder toBuilder() => LoginRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LoginRequestDto &&
        email == other.email &&
        password == other.password;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, password.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'LoginRequestDto')
          ..add('email', email)
          ..add('password', password))
        .toString();
  }
}

class LoginRequestDtoBuilder
    implements Builder<LoginRequestDto, LoginRequestDtoBuilder> {
  _$LoginRequestDto? _$v;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  String? _password;
  String? get password => _$this._password;
  set password(String? password) => _$this._password = password;

  LoginRequestDtoBuilder() {
    LoginRequestDto._defaults(this);
  }

  LoginRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _email = $v.email;
      _password = $v.password;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LoginRequestDto other) {
    _$v = other as _$LoginRequestDto;
  }

  @override
  void update(void Function(LoginRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  LoginRequestDto build() => _build();

  _$LoginRequestDto _build() {
    final _$result =
        _$v ??
        _$LoginRequestDto._(
          email: BuiltValueNullFieldError.checkNotNull(
            email,
            r'LoginRequestDto',
            'email',
          ),
          password: BuiltValueNullFieldError.checkNotNull(
            password,
            r'LoginRequestDto',
            'password',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
