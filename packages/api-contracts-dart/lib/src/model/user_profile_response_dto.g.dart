// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_profile_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$UserProfileResponseDto extends UserProfileResponseDto {
  @override
  final String id;
  @override
  final String email;
  @override
  final String? nickname;
  @override
  final String? avatarUrl;
  @override
  final bool emailVerified;
  @override
  final bool isGuest;
  @override
  final BuiltList<String> roles;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  factory _$UserProfileResponseDto([
    void Function(UserProfileResponseDtoBuilder)? updates,
  ]) => (UserProfileResponseDtoBuilder()..update(updates))._build();

  _$UserProfileResponseDto._({
    required this.id,
    required this.email,
    this.nickname,
    this.avatarUrl,
    required this.emailVerified,
    required this.isGuest,
    required this.roles,
    required this.createdAt,
    required this.updatedAt,
  }) : super._();
  @override
  UserProfileResponseDto rebuild(
    void Function(UserProfileResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  UserProfileResponseDtoBuilder toBuilder() =>
      UserProfileResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is UserProfileResponseDto &&
        id == other.id &&
        email == other.email &&
        nickname == other.nickname &&
        avatarUrl == other.avatarUrl &&
        emailVerified == other.emailVerified &&
        isGuest == other.isGuest &&
        roles == other.roles &&
        createdAt == other.createdAt &&
        updatedAt == other.updatedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, nickname.hashCode);
    _$hash = $jc(_$hash, avatarUrl.hashCode);
    _$hash = $jc(_$hash, emailVerified.hashCode);
    _$hash = $jc(_$hash, isGuest.hashCode);
    _$hash = $jc(_$hash, roles.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'UserProfileResponseDto')
          ..add('id', id)
          ..add('email', email)
          ..add('nickname', nickname)
          ..add('avatarUrl', avatarUrl)
          ..add('emailVerified', emailVerified)
          ..add('isGuest', isGuest)
          ..add('roles', roles)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class UserProfileResponseDtoBuilder
    implements Builder<UserProfileResponseDto, UserProfileResponseDtoBuilder> {
  _$UserProfileResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  String? _nickname;
  String? get nickname => _$this._nickname;
  set nickname(String? nickname) => _$this._nickname = nickname;

  String? _avatarUrl;
  String? get avatarUrl => _$this._avatarUrl;
  set avatarUrl(String? avatarUrl) => _$this._avatarUrl = avatarUrl;

  bool? _emailVerified;
  bool? get emailVerified => _$this._emailVerified;
  set emailVerified(bool? emailVerified) =>
      _$this._emailVerified = emailVerified;

  bool? _isGuest;
  bool? get isGuest => _$this._isGuest;
  set isGuest(bool? isGuest) => _$this._isGuest = isGuest;

  ListBuilder<String>? _roles;
  ListBuilder<String> get roles => _$this._roles ??= ListBuilder<String>();
  set roles(ListBuilder<String>? roles) => _$this._roles = roles;

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  DateTime? _updatedAt;
  DateTime? get updatedAt => _$this._updatedAt;
  set updatedAt(DateTime? updatedAt) => _$this._updatedAt = updatedAt;

  UserProfileResponseDtoBuilder() {
    UserProfileResponseDto._defaults(this);
  }

  UserProfileResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _email = $v.email;
      _nickname = $v.nickname;
      _avatarUrl = $v.avatarUrl;
      _emailVerified = $v.emailVerified;
      _isGuest = $v.isGuest;
      _roles = $v.roles.toBuilder();
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(UserProfileResponseDto other) {
    _$v = other as _$UserProfileResponseDto;
  }

  @override
  void update(void Function(UserProfileResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  UserProfileResponseDto build() => _build();

  _$UserProfileResponseDto _build() {
    _$UserProfileResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$UserProfileResponseDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'UserProfileResponseDto',
              'id',
            ),
            email: BuiltValueNullFieldError.checkNotNull(
              email,
              r'UserProfileResponseDto',
              'email',
            ),
            nickname: nickname,
            avatarUrl: avatarUrl,
            emailVerified: BuiltValueNullFieldError.checkNotNull(
              emailVerified,
              r'UserProfileResponseDto',
              'emailVerified',
            ),
            isGuest: BuiltValueNullFieldError.checkNotNull(
              isGuest,
              r'UserProfileResponseDto',
              'isGuest',
            ),
            roles: roles.build(),
            createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt,
              r'UserProfileResponseDto',
              'createdAt',
            ),
            updatedAt: BuiltValueNullFieldError.checkNotNull(
              updatedAt,
              r'UserProfileResponseDto',
              'updatedAt',
            ),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'roles';
        roles.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'UserProfileResponseDto',
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
