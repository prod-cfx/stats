// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'password_reset_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$PasswordResetRequestDto extends PasswordResetRequestDto {
  @override
  final String email;

  factory _$PasswordResetRequestDto([
    void Function(PasswordResetRequestDtoBuilder)? updates,
  ]) => (PasswordResetRequestDtoBuilder()..update(updates))._build();

  _$PasswordResetRequestDto._({required this.email}) : super._();
  @override
  PasswordResetRequestDto rebuild(
    void Function(PasswordResetRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  PasswordResetRequestDtoBuilder toBuilder() =>
      PasswordResetRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is PasswordResetRequestDto && email == other.email;
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
      r'PasswordResetRequestDto',
    )..add('email', email)).toString();
  }
}

class PasswordResetRequestDtoBuilder
    implements
        Builder<PasswordResetRequestDto, PasswordResetRequestDtoBuilder> {
  _$PasswordResetRequestDto? _$v;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  PasswordResetRequestDtoBuilder() {
    PasswordResetRequestDto._defaults(this);
  }

  PasswordResetRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _email = $v.email;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(PasswordResetRequestDto other) {
    _$v = other as _$PasswordResetRequestDto;
  }

  @override
  void update(void Function(PasswordResetRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  PasswordResetRequestDto build() => _build();

  _$PasswordResetRequestDto _build() {
    final _$result =
        _$v ??
        _$PasswordResetRequestDto._(
          email: BuiltValueNullFieldError.checkNotNull(
            email,
            r'PasswordResetRequestDto',
            'email',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
