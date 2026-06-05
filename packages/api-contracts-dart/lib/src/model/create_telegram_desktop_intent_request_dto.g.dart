// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_telegram_desktop_intent_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const CreateTelegramDesktopIntentRequestDtoIntentEnum
_$createTelegramDesktopIntentRequestDtoIntentEnum_login =
    const CreateTelegramDesktopIntentRequestDtoIntentEnum._('login');
const CreateTelegramDesktopIntentRequestDtoIntentEnum
_$createTelegramDesktopIntentRequestDtoIntentEnum_bind =
    const CreateTelegramDesktopIntentRequestDtoIntentEnum._('bind');

CreateTelegramDesktopIntentRequestDtoIntentEnum
_$createTelegramDesktopIntentRequestDtoIntentEnumValueOf(String name) {
  switch (name) {
    case 'login':
      return _$createTelegramDesktopIntentRequestDtoIntentEnum_login;
    case 'bind':
      return _$createTelegramDesktopIntentRequestDtoIntentEnum_bind;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<CreateTelegramDesktopIntentRequestDtoIntentEnum>
_$createTelegramDesktopIntentRequestDtoIntentEnumValues =
    BuiltSet<CreateTelegramDesktopIntentRequestDtoIntentEnum>(
      const <CreateTelegramDesktopIntentRequestDtoIntentEnum>[
        _$createTelegramDesktopIntentRequestDtoIntentEnum_login,
        _$createTelegramDesktopIntentRequestDtoIntentEnum_bind,
      ],
    );

const CreateTelegramDesktopIntentRequestDtoLngEnum
_$createTelegramDesktopIntentRequestDtoLngEnum_zh =
    const CreateTelegramDesktopIntentRequestDtoLngEnum._('zh');
const CreateTelegramDesktopIntentRequestDtoLngEnum
_$createTelegramDesktopIntentRequestDtoLngEnum_en =
    const CreateTelegramDesktopIntentRequestDtoLngEnum._('en');

CreateTelegramDesktopIntentRequestDtoLngEnum
_$createTelegramDesktopIntentRequestDtoLngEnumValueOf(String name) {
  switch (name) {
    case 'zh':
      return _$createTelegramDesktopIntentRequestDtoLngEnum_zh;
    case 'en':
      return _$createTelegramDesktopIntentRequestDtoLngEnum_en;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<CreateTelegramDesktopIntentRequestDtoLngEnum>
_$createTelegramDesktopIntentRequestDtoLngEnumValues =
    BuiltSet<CreateTelegramDesktopIntentRequestDtoLngEnum>(
      const <CreateTelegramDesktopIntentRequestDtoLngEnum>[
        _$createTelegramDesktopIntentRequestDtoLngEnum_zh,
        _$createTelegramDesktopIntentRequestDtoLngEnum_en,
      ],
    );

Serializer<CreateTelegramDesktopIntentRequestDtoIntentEnum>
_$createTelegramDesktopIntentRequestDtoIntentEnumSerializer =
    _$CreateTelegramDesktopIntentRequestDtoIntentEnumSerializer();
Serializer<CreateTelegramDesktopIntentRequestDtoLngEnum>
_$createTelegramDesktopIntentRequestDtoLngEnumSerializer =
    _$CreateTelegramDesktopIntentRequestDtoLngEnumSerializer();

class _$CreateTelegramDesktopIntentRequestDtoIntentEnumSerializer
    implements
        PrimitiveSerializer<CreateTelegramDesktopIntentRequestDtoIntentEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'login': 'login',
    'bind': 'bind',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'login': 'login',
    'bind': 'bind',
  };

  @override
  final Iterable<Type> types = const <Type>[
    CreateTelegramDesktopIntentRequestDtoIntentEnum,
  ];
  @override
  final String wireName = 'CreateTelegramDesktopIntentRequestDtoIntentEnum';

  @override
  Object serialize(
    Serializers serializers,
    CreateTelegramDesktopIntentRequestDtoIntentEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  CreateTelegramDesktopIntentRequestDtoIntentEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => CreateTelegramDesktopIntentRequestDtoIntentEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$CreateTelegramDesktopIntentRequestDtoLngEnumSerializer
    implements
        PrimitiveSerializer<CreateTelegramDesktopIntentRequestDtoLngEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'zh': 'zh',
    'en': 'en',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'zh': 'zh',
    'en': 'en',
  };

  @override
  final Iterable<Type> types = const <Type>[
    CreateTelegramDesktopIntentRequestDtoLngEnum,
  ];
  @override
  final String wireName = 'CreateTelegramDesktopIntentRequestDtoLngEnum';

  @override
  Object serialize(
    Serializers serializers,
    CreateTelegramDesktopIntentRequestDtoLngEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  CreateTelegramDesktopIntentRequestDtoLngEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => CreateTelegramDesktopIntentRequestDtoLngEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$CreateTelegramDesktopIntentRequestDto
    extends CreateTelegramDesktopIntentRequestDto {
  @override
  final CreateTelegramDesktopIntentRequestDtoIntentEnum? intent;
  @override
  final CreateTelegramDesktopIntentRequestDtoLngEnum? lng;
  @override
  final String? redirect;

  factory _$CreateTelegramDesktopIntentRequestDto([
    void Function(CreateTelegramDesktopIntentRequestDtoBuilder)? updates,
  ]) => (CreateTelegramDesktopIntentRequestDtoBuilder()..update(updates))
      ._build();

  _$CreateTelegramDesktopIntentRequestDto._({
    this.intent,
    this.lng,
    this.redirect,
  }) : super._();
  @override
  CreateTelegramDesktopIntentRequestDto rebuild(
    void Function(CreateTelegramDesktopIntentRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CreateTelegramDesktopIntentRequestDtoBuilder toBuilder() =>
      CreateTelegramDesktopIntentRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateTelegramDesktopIntentRequestDto &&
        intent == other.intent &&
        lng == other.lng &&
        redirect == other.redirect;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, intent.hashCode);
    _$hash = $jc(_$hash, lng.hashCode);
    _$hash = $jc(_$hash, redirect.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'CreateTelegramDesktopIntentRequestDto',
          )
          ..add('intent', intent)
          ..add('lng', lng)
          ..add('redirect', redirect))
        .toString();
  }
}

class CreateTelegramDesktopIntentRequestDtoBuilder
    implements
        Builder<
          CreateTelegramDesktopIntentRequestDto,
          CreateTelegramDesktopIntentRequestDtoBuilder
        > {
  _$CreateTelegramDesktopIntentRequestDto? _$v;

  CreateTelegramDesktopIntentRequestDtoIntentEnum? _intent;
  CreateTelegramDesktopIntentRequestDtoIntentEnum? get intent => _$this._intent;
  set intent(CreateTelegramDesktopIntentRequestDtoIntentEnum? intent) =>
      _$this._intent = intent;

  CreateTelegramDesktopIntentRequestDtoLngEnum? _lng;
  CreateTelegramDesktopIntentRequestDtoLngEnum? get lng => _$this._lng;
  set lng(CreateTelegramDesktopIntentRequestDtoLngEnum? lng) =>
      _$this._lng = lng;

  String? _redirect;
  String? get redirect => _$this._redirect;
  set redirect(String? redirect) => _$this._redirect = redirect;

  CreateTelegramDesktopIntentRequestDtoBuilder() {
    CreateTelegramDesktopIntentRequestDto._defaults(this);
  }

  CreateTelegramDesktopIntentRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _intent = $v.intent;
      _lng = $v.lng;
      _redirect = $v.redirect;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateTelegramDesktopIntentRequestDto other) {
    _$v = other as _$CreateTelegramDesktopIntentRequestDto;
  }

  @override
  void update(
    void Function(CreateTelegramDesktopIntentRequestDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  CreateTelegramDesktopIntentRequestDto build() => _build();

  _$CreateTelegramDesktopIntentRequestDto _build() {
    final _$result =
        _$v ??
        _$CreateTelegramDesktopIntentRequestDto._(
          intent: intent,
          lng: lng,
          redirect: redirect,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
