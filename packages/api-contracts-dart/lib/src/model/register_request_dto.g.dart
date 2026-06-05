// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'register_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$RegisterRequestDto extends RegisterRequestDto {
  @override
  final String email;
  @override
  final String password;
  @override
  final String? nickname;
  @override
  final String? betaCode;

  factory _$RegisterRequestDto([
    void Function(RegisterRequestDtoBuilder)? updates,
  ]) => (RegisterRequestDtoBuilder()..update(updates))._build();

  _$RegisterRequestDto._({
    required this.email,
    required this.password,
    this.nickname,
    this.betaCode,
  }) : super._();
  @override
  RegisterRequestDto rebuild(
    void Function(RegisterRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  RegisterRequestDtoBuilder toBuilder() =>
      RegisterRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is RegisterRequestDto &&
        email == other.email &&
        password == other.password &&
        nickname == other.nickname &&
        betaCode == other.betaCode;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, password.hashCode);
    _$hash = $jc(_$hash, nickname.hashCode);
    _$hash = $jc(_$hash, betaCode.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'RegisterRequestDto')
          ..add('email', email)
          ..add('password', password)
          ..add('nickname', nickname)
          ..add('betaCode', betaCode))
        .toString();
  }
}

class RegisterRequestDtoBuilder
    implements Builder<RegisterRequestDto, RegisterRequestDtoBuilder> {
  _$RegisterRequestDto? _$v;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  String? _password;
  String? get password => _$this._password;
  set password(String? password) => _$this._password = password;

  String? _nickname;
  String? get nickname => _$this._nickname;
  set nickname(String? nickname) => _$this._nickname = nickname;

  String? _betaCode;
  String? get betaCode => _$this._betaCode;
  set betaCode(String? betaCode) => _$this._betaCode = betaCode;

  RegisterRequestDtoBuilder() {
    RegisterRequestDto._defaults(this);
  }

  RegisterRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _email = $v.email;
      _password = $v.password;
      _nickname = $v.nickname;
      _betaCode = $v.betaCode;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(RegisterRequestDto other) {
    _$v = other as _$RegisterRequestDto;
  }

  @override
  void update(void Function(RegisterRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  RegisterRequestDto build() => _build();

  _$RegisterRequestDto _build() {
    final _$result =
        _$v ??
        _$RegisterRequestDto._(
          email: BuiltValueNullFieldError.checkNotNull(
            email,
            r'RegisterRequestDto',
            'email',
          ),
          password: BuiltValueNullFieldError.checkNotNull(
            password,
            r'RegisterRequestDto',
            'password',
          ),
          nickname: nickname,
          betaCode: betaCode,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
