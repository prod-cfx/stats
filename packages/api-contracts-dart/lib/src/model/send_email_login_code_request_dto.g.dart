// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'send_email_login_code_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$SendEmailLoginCodeRequestDto extends SendEmailLoginCodeRequestDto {
  @override
  final String email;

  factory _$SendEmailLoginCodeRequestDto([
    void Function(SendEmailLoginCodeRequestDtoBuilder)? updates,
  ]) => (SendEmailLoginCodeRequestDtoBuilder()..update(updates))._build();

  _$SendEmailLoginCodeRequestDto._({required this.email}) : super._();
  @override
  SendEmailLoginCodeRequestDto rebuild(
    void Function(SendEmailLoginCodeRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  SendEmailLoginCodeRequestDtoBuilder toBuilder() =>
      SendEmailLoginCodeRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is SendEmailLoginCodeRequestDto && email == other.email;
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
      r'SendEmailLoginCodeRequestDto',
    )..add('email', email)).toString();
  }
}

class SendEmailLoginCodeRequestDtoBuilder
    implements
        Builder<
          SendEmailLoginCodeRequestDto,
          SendEmailLoginCodeRequestDtoBuilder
        > {
  _$SendEmailLoginCodeRequestDto? _$v;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  SendEmailLoginCodeRequestDtoBuilder() {
    SendEmailLoginCodeRequestDto._defaults(this);
  }

  SendEmailLoginCodeRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _email = $v.email;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(SendEmailLoginCodeRequestDto other) {
    _$v = other as _$SendEmailLoginCodeRequestDto;
  }

  @override
  void update(void Function(SendEmailLoginCodeRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  SendEmailLoginCodeRequestDto build() => _build();

  _$SendEmailLoginCodeRequestDto _build() {
    final _$result =
        _$v ??
        _$SendEmailLoginCodeRequestDto._(
          email: BuiltValueNullFieldError.checkNotNull(
            email,
            r'SendEmailLoginCodeRequestDto',
            'email',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
