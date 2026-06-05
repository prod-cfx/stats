// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'verify_email_login_code_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$VerifyEmailLoginCodeRequestDto extends VerifyEmailLoginCodeRequestDto {
  @override
  final String email;
  @override
  final String code;
  @override
  final String? betaCode;

  factory _$VerifyEmailLoginCodeRequestDto([
    void Function(VerifyEmailLoginCodeRequestDtoBuilder)? updates,
  ]) => (VerifyEmailLoginCodeRequestDtoBuilder()..update(updates))._build();

  _$VerifyEmailLoginCodeRequestDto._({
    required this.email,
    required this.code,
    this.betaCode,
  }) : super._();
  @override
  VerifyEmailLoginCodeRequestDto rebuild(
    void Function(VerifyEmailLoginCodeRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  VerifyEmailLoginCodeRequestDtoBuilder toBuilder() =>
      VerifyEmailLoginCodeRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is VerifyEmailLoginCodeRequestDto &&
        email == other.email &&
        code == other.code &&
        betaCode == other.betaCode;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jc(_$hash, betaCode.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'VerifyEmailLoginCodeRequestDto')
          ..add('email', email)
          ..add('code', code)
          ..add('betaCode', betaCode))
        .toString();
  }
}

class VerifyEmailLoginCodeRequestDtoBuilder
    implements
        Builder<
          VerifyEmailLoginCodeRequestDto,
          VerifyEmailLoginCodeRequestDtoBuilder
        > {
  _$VerifyEmailLoginCodeRequestDto? _$v;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  String? _code;
  String? get code => _$this._code;
  set code(String? code) => _$this._code = code;

  String? _betaCode;
  String? get betaCode => _$this._betaCode;
  set betaCode(String? betaCode) => _$this._betaCode = betaCode;

  VerifyEmailLoginCodeRequestDtoBuilder() {
    VerifyEmailLoginCodeRequestDto._defaults(this);
  }

  VerifyEmailLoginCodeRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _email = $v.email;
      _code = $v.code;
      _betaCode = $v.betaCode;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(VerifyEmailLoginCodeRequestDto other) {
    _$v = other as _$VerifyEmailLoginCodeRequestDto;
  }

  @override
  void update(void Function(VerifyEmailLoginCodeRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  VerifyEmailLoginCodeRequestDto build() => _build();

  _$VerifyEmailLoginCodeRequestDto _build() {
    final _$result =
        _$v ??
        _$VerifyEmailLoginCodeRequestDto._(
          email: BuiltValueNullFieldError.checkNotNull(
            email,
            r'VerifyEmailLoginCodeRequestDto',
            'email',
          ),
          code: BuiltValueNullFieldError.checkNotNull(
            code,
            r'VerifyEmailLoginCodeRequestDto',
            'code',
          ),
          betaCode: betaCode,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
