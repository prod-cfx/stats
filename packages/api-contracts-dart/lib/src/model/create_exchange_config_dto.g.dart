// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_exchange_config_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const CreateExchangeConfigDtoVenueTypeEnum
_$createExchangeConfigDtoVenueTypeEnum_CEX =
    const CreateExchangeConfigDtoVenueTypeEnum._('CEX');
const CreateExchangeConfigDtoVenueTypeEnum
_$createExchangeConfigDtoVenueTypeEnum_DEX =
    const CreateExchangeConfigDtoVenueTypeEnum._('DEX');

CreateExchangeConfigDtoVenueTypeEnum
_$createExchangeConfigDtoVenueTypeEnumValueOf(String name) {
  switch (name) {
    case 'CEX':
      return _$createExchangeConfigDtoVenueTypeEnum_CEX;
    case 'DEX':
      return _$createExchangeConfigDtoVenueTypeEnum_DEX;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<CreateExchangeConfigDtoVenueTypeEnum>
_$createExchangeConfigDtoVenueTypeEnumValues =
    BuiltSet<CreateExchangeConfigDtoVenueTypeEnum>(
      const <CreateExchangeConfigDtoVenueTypeEnum>[
        _$createExchangeConfigDtoVenueTypeEnum_CEX,
        _$createExchangeConfigDtoVenueTypeEnum_DEX,
      ],
    );

Serializer<CreateExchangeConfigDtoVenueTypeEnum>
_$createExchangeConfigDtoVenueTypeEnumSerializer =
    _$CreateExchangeConfigDtoVenueTypeEnumSerializer();

class _$CreateExchangeConfigDtoVenueTypeEnumSerializer
    implements PrimitiveSerializer<CreateExchangeConfigDtoVenueTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'CEX': 'CEX',
    'DEX': 'DEX',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'CEX': 'CEX',
    'DEX': 'DEX',
  };

  @override
  final Iterable<Type> types = const <Type>[
    CreateExchangeConfigDtoVenueTypeEnum,
  ];
  @override
  final String wireName = 'CreateExchangeConfigDtoVenueTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    CreateExchangeConfigDtoVenueTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  CreateExchangeConfigDtoVenueTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => CreateExchangeConfigDtoVenueTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$CreateExchangeConfigDto extends CreateExchangeConfigDto {
  @override
  final String code;
  @override
  final String name;
  @override
  final String? avatarUrl;
  @override
  final String? intro;
  @override
  final String? websiteUrl;
  @override
  final CreateExchangeConfigDtoVenueTypeEnum? venueType;
  @override
  final bool? enabled;
  @override
  final num? sort;
  @override
  final JsonObject? metadata;

  factory _$CreateExchangeConfigDto([
    void Function(CreateExchangeConfigDtoBuilder)? updates,
  ]) => (CreateExchangeConfigDtoBuilder()..update(updates))._build();

  _$CreateExchangeConfigDto._({
    required this.code,
    required this.name,
    this.avatarUrl,
    this.intro,
    this.websiteUrl,
    this.venueType,
    this.enabled,
    this.sort,
    this.metadata,
  }) : super._();
  @override
  CreateExchangeConfigDto rebuild(
    void Function(CreateExchangeConfigDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CreateExchangeConfigDtoBuilder toBuilder() =>
      CreateExchangeConfigDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateExchangeConfigDto &&
        code == other.code &&
        name == other.name &&
        avatarUrl == other.avatarUrl &&
        intro == other.intro &&
        websiteUrl == other.websiteUrl &&
        venueType == other.venueType &&
        enabled == other.enabled &&
        sort == other.sort &&
        metadata == other.metadata;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, avatarUrl.hashCode);
    _$hash = $jc(_$hash, intro.hashCode);
    _$hash = $jc(_$hash, websiteUrl.hashCode);
    _$hash = $jc(_$hash, venueType.hashCode);
    _$hash = $jc(_$hash, enabled.hashCode);
    _$hash = $jc(_$hash, sort.hashCode);
    _$hash = $jc(_$hash, metadata.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateExchangeConfigDto')
          ..add('code', code)
          ..add('name', name)
          ..add('avatarUrl', avatarUrl)
          ..add('intro', intro)
          ..add('websiteUrl', websiteUrl)
          ..add('venueType', venueType)
          ..add('enabled', enabled)
          ..add('sort', sort)
          ..add('metadata', metadata))
        .toString();
  }
}

class CreateExchangeConfigDtoBuilder
    implements
        Builder<CreateExchangeConfigDto, CreateExchangeConfigDtoBuilder> {
  _$CreateExchangeConfigDto? _$v;

  String? _code;
  String? get code => _$this._code;
  set code(String? code) => _$this._code = code;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  String? _avatarUrl;
  String? get avatarUrl => _$this._avatarUrl;
  set avatarUrl(String? avatarUrl) => _$this._avatarUrl = avatarUrl;

  String? _intro;
  String? get intro => _$this._intro;
  set intro(String? intro) => _$this._intro = intro;

  String? _websiteUrl;
  String? get websiteUrl => _$this._websiteUrl;
  set websiteUrl(String? websiteUrl) => _$this._websiteUrl = websiteUrl;

  CreateExchangeConfigDtoVenueTypeEnum? _venueType;
  CreateExchangeConfigDtoVenueTypeEnum? get venueType => _$this._venueType;
  set venueType(CreateExchangeConfigDtoVenueTypeEnum? venueType) =>
      _$this._venueType = venueType;

  bool? _enabled;
  bool? get enabled => _$this._enabled;
  set enabled(bool? enabled) => _$this._enabled = enabled;

  num? _sort;
  num? get sort => _$this._sort;
  set sort(num? sort) => _$this._sort = sort;

  JsonObject? _metadata;
  JsonObject? get metadata => _$this._metadata;
  set metadata(JsonObject? metadata) => _$this._metadata = metadata;

  CreateExchangeConfigDtoBuilder() {
    CreateExchangeConfigDto._defaults(this);
  }

  CreateExchangeConfigDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _code = $v.code;
      _name = $v.name;
      _avatarUrl = $v.avatarUrl;
      _intro = $v.intro;
      _websiteUrl = $v.websiteUrl;
      _venueType = $v.venueType;
      _enabled = $v.enabled;
      _sort = $v.sort;
      _metadata = $v.metadata;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateExchangeConfigDto other) {
    _$v = other as _$CreateExchangeConfigDto;
  }

  @override
  void update(void Function(CreateExchangeConfigDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateExchangeConfigDto build() => _build();

  _$CreateExchangeConfigDto _build() {
    final _$result =
        _$v ??
        _$CreateExchangeConfigDto._(
          code: BuiltValueNullFieldError.checkNotNull(
            code,
            r'CreateExchangeConfigDto',
            'code',
          ),
          name: BuiltValueNullFieldError.checkNotNull(
            name,
            r'CreateExchangeConfigDto',
            'name',
          ),
          avatarUrl: avatarUrl,
          intro: intro,
          websiteUrl: websiteUrl,
          venueType: venueType,
          enabled: enabled,
          sort: sort,
          metadata: metadata,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
