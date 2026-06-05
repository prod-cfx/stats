// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bind_telegram_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$BindTelegramRequestDto extends BindTelegramRequestDto {
  @override
  final String telegramId;
  @override
  final String authDate;
  @override
  final String hash;
  @override
  final String? firstName;
  @override
  final String? lastName;
  @override
  final String? username;
  @override
  final String? photoUrl;

  factory _$BindTelegramRequestDto([
    void Function(BindTelegramRequestDtoBuilder)? updates,
  ]) => (BindTelegramRequestDtoBuilder()..update(updates))._build();

  _$BindTelegramRequestDto._({
    required this.telegramId,
    required this.authDate,
    required this.hash,
    this.firstName,
    this.lastName,
    this.username,
    this.photoUrl,
  }) : super._();
  @override
  BindTelegramRequestDto rebuild(
    void Function(BindTelegramRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BindTelegramRequestDtoBuilder toBuilder() =>
      BindTelegramRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BindTelegramRequestDto &&
        telegramId == other.telegramId &&
        authDate == other.authDate &&
        hash == other.hash &&
        firstName == other.firstName &&
        lastName == other.lastName &&
        username == other.username &&
        photoUrl == other.photoUrl;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, telegramId.hashCode);
    _$hash = $jc(_$hash, authDate.hashCode);
    _$hash = $jc(_$hash, hash.hashCode);
    _$hash = $jc(_$hash, firstName.hashCode);
    _$hash = $jc(_$hash, lastName.hashCode);
    _$hash = $jc(_$hash, username.hashCode);
    _$hash = $jc(_$hash, photoUrl.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'BindTelegramRequestDto')
          ..add('telegramId', telegramId)
          ..add('authDate', authDate)
          ..add('hash', hash)
          ..add('firstName', firstName)
          ..add('lastName', lastName)
          ..add('username', username)
          ..add('photoUrl', photoUrl))
        .toString();
  }
}

class BindTelegramRequestDtoBuilder
    implements Builder<BindTelegramRequestDto, BindTelegramRequestDtoBuilder> {
  _$BindTelegramRequestDto? _$v;

  String? _telegramId;
  String? get telegramId => _$this._telegramId;
  set telegramId(String? telegramId) => _$this._telegramId = telegramId;

  String? _authDate;
  String? get authDate => _$this._authDate;
  set authDate(String? authDate) => _$this._authDate = authDate;

  String? _hash;
  String? get hash => _$this._hash;
  set hash(String? hash) => _$this._hash = hash;

  String? _firstName;
  String? get firstName => _$this._firstName;
  set firstName(String? firstName) => _$this._firstName = firstName;

  String? _lastName;
  String? get lastName => _$this._lastName;
  set lastName(String? lastName) => _$this._lastName = lastName;

  String? _username;
  String? get username => _$this._username;
  set username(String? username) => _$this._username = username;

  String? _photoUrl;
  String? get photoUrl => _$this._photoUrl;
  set photoUrl(String? photoUrl) => _$this._photoUrl = photoUrl;

  BindTelegramRequestDtoBuilder() {
    BindTelegramRequestDto._defaults(this);
  }

  BindTelegramRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _telegramId = $v.telegramId;
      _authDate = $v.authDate;
      _hash = $v.hash;
      _firstName = $v.firstName;
      _lastName = $v.lastName;
      _username = $v.username;
      _photoUrl = $v.photoUrl;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BindTelegramRequestDto other) {
    _$v = other as _$BindTelegramRequestDto;
  }

  @override
  void update(void Function(BindTelegramRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  BindTelegramRequestDto build() => _build();

  _$BindTelegramRequestDto _build() {
    final _$result =
        _$v ??
        _$BindTelegramRequestDto._(
          telegramId: BuiltValueNullFieldError.checkNotNull(
            telegramId,
            r'BindTelegramRequestDto',
            'telegramId',
          ),
          authDate: BuiltValueNullFieldError.checkNotNull(
            authDate,
            r'BindTelegramRequestDto',
            'authDate',
          ),
          hash: BuiltValueNullFieldError.checkNotNull(
            hash,
            r'BindTelegramRequestDto',
            'hash',
          ),
          firstName: firstName,
          lastName: lastName,
          username: username,
          photoUrl: photoUrl,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
