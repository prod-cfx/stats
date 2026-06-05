// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'verify_email_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$VerifyEmailRequestDto extends VerifyEmailRequestDto {
  @override
  final String email;
  @override
  final String code;
  @override
  final bool? updateUserStatus;

  factory _$VerifyEmailRequestDto([
    void Function(VerifyEmailRequestDtoBuilder)? updates,
  ]) => (VerifyEmailRequestDtoBuilder()..update(updates))._build();

  _$VerifyEmailRequestDto._({
    required this.email,
    required this.code,
    this.updateUserStatus,
  }) : super._();
  @override
  VerifyEmailRequestDto rebuild(
    void Function(VerifyEmailRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  VerifyEmailRequestDtoBuilder toBuilder() =>
      VerifyEmailRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is VerifyEmailRequestDto &&
        email == other.email &&
        code == other.code &&
        updateUserStatus == other.updateUserStatus;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jc(_$hash, updateUserStatus.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'VerifyEmailRequestDto')
          ..add('email', email)
          ..add('code', code)
          ..add('updateUserStatus', updateUserStatus))
        .toString();
  }
}

class VerifyEmailRequestDtoBuilder
    implements Builder<VerifyEmailRequestDto, VerifyEmailRequestDtoBuilder> {
  _$VerifyEmailRequestDto? _$v;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  String? _code;
  String? get code => _$this._code;
  set code(String? code) => _$this._code = code;

  bool? _updateUserStatus;
  bool? get updateUserStatus => _$this._updateUserStatus;
  set updateUserStatus(bool? updateUserStatus) =>
      _$this._updateUserStatus = updateUserStatus;

  VerifyEmailRequestDtoBuilder() {
    VerifyEmailRequestDto._defaults(this);
  }

  VerifyEmailRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _email = $v.email;
      _code = $v.code;
      _updateUserStatus = $v.updateUserStatus;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(VerifyEmailRequestDto other) {
    _$v = other as _$VerifyEmailRequestDto;
  }

  @override
  void update(void Function(VerifyEmailRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  VerifyEmailRequestDto build() => _build();

  _$VerifyEmailRequestDto _build() {
    final _$result =
        _$v ??
        _$VerifyEmailRequestDto._(
          email: BuiltValueNullFieldError.checkNotNull(
            email,
            r'VerifyEmailRequestDto',
            'email',
          ),
          code: BuiltValueNullFieldError.checkNotNull(
            code,
            r'VerifyEmailRequestDto',
            'code',
          ),
          updateUserStatus: updateUserStatus,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
