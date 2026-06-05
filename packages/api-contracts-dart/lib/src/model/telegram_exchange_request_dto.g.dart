// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'telegram_exchange_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const TelegramExchangeRequestDtoSource_Enum
_$telegramExchangeRequestDtoSourceEnum_web =
    const TelegramExchangeRequestDtoSource_Enum._('web');
const TelegramExchangeRequestDtoSource_Enum
_$telegramExchangeRequestDtoSourceEnum_desktop =
    const TelegramExchangeRequestDtoSource_Enum._('desktop');
const TelegramExchangeRequestDtoSource_Enum
_$telegramExchangeRequestDtoSourceEnum_webapp =
    const TelegramExchangeRequestDtoSource_Enum._('webapp');

TelegramExchangeRequestDtoSource_Enum
_$telegramExchangeRequestDtoSourceEnumValueOf(String name) {
  switch (name) {
    case 'web':
      return _$telegramExchangeRequestDtoSourceEnum_web;
    case 'desktop':
      return _$telegramExchangeRequestDtoSourceEnum_desktop;
    case 'webapp':
      return _$telegramExchangeRequestDtoSourceEnum_webapp;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<TelegramExchangeRequestDtoSource_Enum>
_$telegramExchangeRequestDtoSourceEnumValues =
    BuiltSet<TelegramExchangeRequestDtoSource_Enum>(
      const <TelegramExchangeRequestDtoSource_Enum>[
        _$telegramExchangeRequestDtoSourceEnum_web,
        _$telegramExchangeRequestDtoSourceEnum_desktop,
        _$telegramExchangeRequestDtoSourceEnum_webapp,
      ],
    );

Serializer<TelegramExchangeRequestDtoSource_Enum>
_$telegramExchangeRequestDtoSourceEnumSerializer =
    _$TelegramExchangeRequestDtoSource_EnumSerializer();

class _$TelegramExchangeRequestDtoSource_EnumSerializer
    implements PrimitiveSerializer<TelegramExchangeRequestDtoSource_Enum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'web': 'web',
    'desktop': 'desktop',
    'webapp': 'webapp',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'web': 'web',
    'desktop': 'desktop',
    'webapp': 'webapp',
  };

  @override
  final Iterable<Type> types = const <Type>[
    TelegramExchangeRequestDtoSource_Enum,
  ];
  @override
  final String wireName = 'TelegramExchangeRequestDtoSource_Enum';

  @override
  Object serialize(
    Serializers serializers,
    TelegramExchangeRequestDtoSource_Enum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  TelegramExchangeRequestDtoSource_Enum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => TelegramExchangeRequestDtoSource_Enum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$TelegramExchangeRequestDto extends TelegramExchangeRequestDto {
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
  @override
  final TelegramExchangeRequestDtoSource_Enum? source_;
  @override
  final String? betaCode;

  factory _$TelegramExchangeRequestDto([
    void Function(TelegramExchangeRequestDtoBuilder)? updates,
  ]) => (TelegramExchangeRequestDtoBuilder()..update(updates))._build();

  _$TelegramExchangeRequestDto._({
    required this.telegramId,
    required this.authDate,
    required this.hash,
    this.firstName,
    this.lastName,
    this.username,
    this.photoUrl,
    this.source_,
    this.betaCode,
  }) : super._();
  @override
  TelegramExchangeRequestDto rebuild(
    void Function(TelegramExchangeRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TelegramExchangeRequestDtoBuilder toBuilder() =>
      TelegramExchangeRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TelegramExchangeRequestDto &&
        telegramId == other.telegramId &&
        authDate == other.authDate &&
        hash == other.hash &&
        firstName == other.firstName &&
        lastName == other.lastName &&
        username == other.username &&
        photoUrl == other.photoUrl &&
        source_ == other.source_ &&
        betaCode == other.betaCode;
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
    _$hash = $jc(_$hash, source_.hashCode);
    _$hash = $jc(_$hash, betaCode.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'TelegramExchangeRequestDto')
          ..add('telegramId', telegramId)
          ..add('authDate', authDate)
          ..add('hash', hash)
          ..add('firstName', firstName)
          ..add('lastName', lastName)
          ..add('username', username)
          ..add('photoUrl', photoUrl)
          ..add('source_', source_)
          ..add('betaCode', betaCode))
        .toString();
  }
}

class TelegramExchangeRequestDtoBuilder
    implements
        Builder<TelegramExchangeRequestDto, TelegramExchangeRequestDtoBuilder> {
  _$TelegramExchangeRequestDto? _$v;

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

  TelegramExchangeRequestDtoSource_Enum? _source_;
  TelegramExchangeRequestDtoSource_Enum? get source_ => _$this._source_;
  set source_(TelegramExchangeRequestDtoSource_Enum? source_) =>
      _$this._source_ = source_;

  String? _betaCode;
  String? get betaCode => _$this._betaCode;
  set betaCode(String? betaCode) => _$this._betaCode = betaCode;

  TelegramExchangeRequestDtoBuilder() {
    TelegramExchangeRequestDto._defaults(this);
  }

  TelegramExchangeRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _telegramId = $v.telegramId;
      _authDate = $v.authDate;
      _hash = $v.hash;
      _firstName = $v.firstName;
      _lastName = $v.lastName;
      _username = $v.username;
      _photoUrl = $v.photoUrl;
      _source_ = $v.source_;
      _betaCode = $v.betaCode;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(TelegramExchangeRequestDto other) {
    _$v = other as _$TelegramExchangeRequestDto;
  }

  @override
  void update(void Function(TelegramExchangeRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TelegramExchangeRequestDto build() => _build();

  _$TelegramExchangeRequestDto _build() {
    final _$result =
        _$v ??
        _$TelegramExchangeRequestDto._(
          telegramId: BuiltValueNullFieldError.checkNotNull(
            telegramId,
            r'TelegramExchangeRequestDto',
            'telegramId',
          ),
          authDate: BuiltValueNullFieldError.checkNotNull(
            authDate,
            r'TelegramExchangeRequestDto',
            'authDate',
          ),
          hash: BuiltValueNullFieldError.checkNotNull(
            hash,
            r'TelegramExchangeRequestDto',
            'hash',
          ),
          firstName: firstName,
          lastName: lastName,
          username: username,
          photoUrl: photoUrl,
          source_: source_,
          betaCode: betaCode,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
