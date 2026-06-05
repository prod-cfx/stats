// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AuthResponseDto extends AuthResponseDto {
  @override
  final String accessToken;
  @override
  final UserProfileResponseDto user;

  factory _$AuthResponseDto([void Function(AuthResponseDtoBuilder)? updates]) =>
      (AuthResponseDtoBuilder()..update(updates))._build();

  _$AuthResponseDto._({required this.accessToken, required this.user})
    : super._();
  @override
  AuthResponseDto rebuild(void Function(AuthResponseDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  AuthResponseDtoBuilder toBuilder() => AuthResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AuthResponseDto &&
        accessToken == other.accessToken &&
        user == other.user;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, accessToken.hashCode);
    _$hash = $jc(_$hash, user.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AuthResponseDto')
          ..add('accessToken', accessToken)
          ..add('user', user))
        .toString();
  }
}

class AuthResponseDtoBuilder
    implements Builder<AuthResponseDto, AuthResponseDtoBuilder> {
  _$AuthResponseDto? _$v;

  String? _accessToken;
  String? get accessToken => _$this._accessToken;
  set accessToken(String? accessToken) => _$this._accessToken = accessToken;

  UserProfileResponseDtoBuilder? _user;
  UserProfileResponseDtoBuilder get user =>
      _$this._user ??= UserProfileResponseDtoBuilder();
  set user(UserProfileResponseDtoBuilder? user) => _$this._user = user;

  AuthResponseDtoBuilder() {
    AuthResponseDto._defaults(this);
  }

  AuthResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _accessToken = $v.accessToken;
      _user = $v.user.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AuthResponseDto other) {
    _$v = other as _$AuthResponseDto;
  }

  @override
  void update(void Function(AuthResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AuthResponseDto build() => _build();

  _$AuthResponseDto _build() {
    _$AuthResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$AuthResponseDto._(
            accessToken: BuiltValueNullFieldError.checkNotNull(
              accessToken,
              r'AuthResponseDto',
              'accessToken',
            ),
            user: user.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'user';
        user.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AuthResponseDto',
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
