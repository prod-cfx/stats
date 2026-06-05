// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'resend_verification_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$ResendVerificationRequestDto extends ResendVerificationRequestDto {
  @override
  final String email;

  factory _$ResendVerificationRequestDto([
    void Function(ResendVerificationRequestDtoBuilder)? updates,
  ]) => (ResendVerificationRequestDtoBuilder()..update(updates))._build();

  _$ResendVerificationRequestDto._({required this.email}) : super._();
  @override
  ResendVerificationRequestDto rebuild(
    void Function(ResendVerificationRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  ResendVerificationRequestDtoBuilder toBuilder() =>
      ResendVerificationRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is ResendVerificationRequestDto && email == other.email;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'ResendVerificationRequestDto',
    )..add('email', email)).toString();
  }
}

class ResendVerificationRequestDtoBuilder
    implements
        Builder<
          ResendVerificationRequestDto,
          ResendVerificationRequestDtoBuilder
        > {
  _$ResendVerificationRequestDto? _$v;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  ResendVerificationRequestDtoBuilder() {
    ResendVerificationRequestDto._defaults(this);
  }

  ResendVerificationRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _email = $v.email;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(ResendVerificationRequestDto other) {
    _$v = other as _$ResendVerificationRequestDto;
  }

  @override
  void update(void Function(ResendVerificationRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  ResendVerificationRequestDto build() => _build();

  _$ResendVerificationRequestDto _build() {
    final _$result =
        _$v ??
        _$ResendVerificationRequestDto._(
          email: BuiltValueNullFieldError.checkNotNull(
            email,
            r'ResendVerificationRequestDto',
            'email',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
