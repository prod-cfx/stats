// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'verify_password_reset_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$VerifyPasswordResetRequestDto extends VerifyPasswordResetRequestDto {
  @override
  final String email;
  @override
  final String code;
  @override
  final String newPassword;

  factory _$VerifyPasswordResetRequestDto([
    void Function(VerifyPasswordResetRequestDtoBuilder)? updates,
  ]) => (VerifyPasswordResetRequestDtoBuilder()..update(updates))._build();

  _$VerifyPasswordResetRequestDto._({
    required this.email,
    required this.code,
    required this.newPassword,
  }) : super._();
  @override
  VerifyPasswordResetRequestDto rebuild(
    void Function(VerifyPasswordResetRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  VerifyPasswordResetRequestDtoBuilder toBuilder() =>
      VerifyPasswordResetRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is VerifyPasswordResetRequestDto &&
        email == other.email &&
        code == other.code &&
        newPassword == other.newPassword;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jc(_$hash, newPassword.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'VerifyPasswordResetRequestDto')
          ..add('email', email)
          ..add('code', code)
          ..add('newPassword', newPassword))
        .toString();
  }
}

class VerifyPasswordResetRequestDtoBuilder
    implements
        Builder<
          VerifyPasswordResetRequestDto,
          VerifyPasswordResetRequestDtoBuilder
        > {
  _$VerifyPasswordResetRequestDto? _$v;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  String? _code;
  String? get code => _$this._code;
  set code(String? code) => _$this._code = code;

  String? _newPassword;
  String? get newPassword => _$this._newPassword;
  set newPassword(String? newPassword) => _$this._newPassword = newPassword;

  VerifyPasswordResetRequestDtoBuilder() {
    VerifyPasswordResetRequestDto._defaults(this);
  }

  VerifyPasswordResetRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _email = $v.email;
      _code = $v.code;
      _newPassword = $v.newPassword;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(VerifyPasswordResetRequestDto other) {
    _$v = other as _$VerifyPasswordResetRequestDto;
  }

  @override
  void update(void Function(VerifyPasswordResetRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  VerifyPasswordResetRequestDto build() => _build();

  _$VerifyPasswordResetRequestDto _build() {
    final _$result =
        _$v ??
        _$VerifyPasswordResetRequestDto._(
          email: BuiltValueNullFieldError.checkNotNull(
            email,
            r'VerifyPasswordResetRequestDto',
            'email',
          ),
          code: BuiltValueNullFieldError.checkNotNull(
            code,
            r'VerifyPasswordResetRequestDto',
            'code',
          ),
          newPassword: BuiltValueNullFieldError.checkNotNull(
            newPassword,
            r'VerifyPasswordResetRequestDto',
            'newPassword',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
