// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'exchange_config_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const ExchangeConfigResponseDtoVenueTypeEnum
_$exchangeConfigResponseDtoVenueTypeEnum_CEX =
    const ExchangeConfigResponseDtoVenueTypeEnum._('CEX');
const ExchangeConfigResponseDtoVenueTypeEnum
_$exchangeConfigResponseDtoVenueTypeEnum_DEX =
    const ExchangeConfigResponseDtoVenueTypeEnum._('DEX');

ExchangeConfigResponseDtoVenueTypeEnum
_$exchangeConfigResponseDtoVenueTypeEnumValueOf(String name) {
  switch (name) {
    case 'CEX':
      return _$exchangeConfigResponseDtoVenueTypeEnum_CEX;
    case 'DEX':
      return _$exchangeConfigResponseDtoVenueTypeEnum_DEX;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<ExchangeConfigResponseDtoVenueTypeEnum>
_$exchangeConfigResponseDtoVenueTypeEnumValues =
    BuiltSet<ExchangeConfigResponseDtoVenueTypeEnum>(
      const <ExchangeConfigResponseDtoVenueTypeEnum>[
        _$exchangeConfigResponseDtoVenueTypeEnum_CEX,
        _$exchangeConfigResponseDtoVenueTypeEnum_DEX,
      ],
    );

Serializer<ExchangeConfigResponseDtoVenueTypeEnum>
_$exchangeConfigResponseDtoVenueTypeEnumSerializer =
    _$ExchangeConfigResponseDtoVenueTypeEnumSerializer();

class _$ExchangeConfigResponseDtoVenueTypeEnumSerializer
    implements PrimitiveSerializer<ExchangeConfigResponseDtoVenueTypeEnum> {
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
    ExchangeConfigResponseDtoVenueTypeEnum,
  ];
  @override
  final String wireName = 'ExchangeConfigResponseDtoVenueTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    ExchangeConfigResponseDtoVenueTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  ExchangeConfigResponseDtoVenueTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => ExchangeConfigResponseDtoVenueTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$ExchangeConfigResponseDto extends ExchangeConfigResponseDto {
  @override
  final String id;
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
  final ExchangeConfigResponseDtoVenueTypeEnum? venueType;
  @override
  final bool enabled;
  @override
  final num sort;
  @override
  final JsonObject? metadata;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  factory _$ExchangeConfigResponseDto([
    void Function(ExchangeConfigResponseDtoBuilder)? updates,
  ]) => (ExchangeConfigResponseDtoBuilder()..update(updates))._build();

  _$ExchangeConfigResponseDto._({
    required this.id,
    required this.code,
    required this.name,
    this.avatarUrl,
    this.intro,
    this.websiteUrl,
    this.venueType,
    required this.enabled,
    required this.sort,
    this.metadata,
    required this.createdAt,
    required this.updatedAt,
  }) : super._();
  @override
  ExchangeConfigResponseDto rebuild(
    void Function(ExchangeConfigResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  ExchangeConfigResponseDtoBuilder toBuilder() =>
      ExchangeConfigResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is ExchangeConfigResponseDto &&
        id == other.id &&
        code == other.code &&
        name == other.name &&
        avatarUrl == other.avatarUrl &&
        intro == other.intro &&
        websiteUrl == other.websiteUrl &&
        venueType == other.venueType &&
        enabled == other.enabled &&
        sort == other.sort &&
        metadata == other.metadata &&
        createdAt == other.createdAt &&
        updatedAt == other.updatedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, avatarUrl.hashCode);
    _$hash = $jc(_$hash, intro.hashCode);
    _$hash = $jc(_$hash, websiteUrl.hashCode);
    _$hash = $jc(_$hash, venueType.hashCode);
    _$hash = $jc(_$hash, enabled.hashCode);
    _$hash = $jc(_$hash, sort.hashCode);
    _$hash = $jc(_$hash, metadata.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'ExchangeConfigResponseDto')
          ..add('id', id)
          ..add('code', code)
          ..add('name', name)
          ..add('avatarUrl', avatarUrl)
          ..add('intro', intro)
          ..add('websiteUrl', websiteUrl)
          ..add('venueType', venueType)
          ..add('enabled', enabled)
          ..add('sort', sort)
          ..add('metadata', metadata)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class ExchangeConfigResponseDtoBuilder
    implements
        Builder<ExchangeConfigResponseDto, ExchangeConfigResponseDtoBuilder> {
  _$ExchangeConfigResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

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

  ExchangeConfigResponseDtoVenueTypeEnum? _venueType;
  ExchangeConfigResponseDtoVenueTypeEnum? get venueType => _$this._venueType;
  set venueType(ExchangeConfigResponseDtoVenueTypeEnum? venueType) =>
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

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  DateTime? _updatedAt;
  DateTime? get updatedAt => _$this._updatedAt;
  set updatedAt(DateTime? updatedAt) => _$this._updatedAt = updatedAt;

  ExchangeConfigResponseDtoBuilder() {
    ExchangeConfigResponseDto._defaults(this);
  }

  ExchangeConfigResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _code = $v.code;
      _name = $v.name;
      _avatarUrl = $v.avatarUrl;
      _intro = $v.intro;
      _websiteUrl = $v.websiteUrl;
      _venueType = $v.venueType;
      _enabled = $v.enabled;
      _sort = $v.sort;
      _metadata = $v.metadata;
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(ExchangeConfigResponseDto other) {
    _$v = other as _$ExchangeConfigResponseDto;
  }

  @override
  void update(void Function(ExchangeConfigResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  ExchangeConfigResponseDto build() => _build();

  _$ExchangeConfigResponseDto _build() {
    final _$result =
        _$v ??
        _$ExchangeConfigResponseDto._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'ExchangeConfigResponseDto',
            'id',
          ),
          code: BuiltValueNullFieldError.checkNotNull(
            code,
            r'ExchangeConfigResponseDto',
            'code',
          ),
          name: BuiltValueNullFieldError.checkNotNull(
            name,
            r'ExchangeConfigResponseDto',
            'name',
          ),
          avatarUrl: avatarUrl,
          intro: intro,
          websiteUrl: websiteUrl,
          venueType: venueType,
          enabled: BuiltValueNullFieldError.checkNotNull(
            enabled,
            r'ExchangeConfigResponseDto',
            'enabled',
          ),
          sort: BuiltValueNullFieldError.checkNotNull(
            sort,
            r'ExchangeConfigResponseDto',
            'sort',
          ),
          metadata: metadata,
          createdAt: BuiltValueNullFieldError.checkNotNull(
            createdAt,
            r'ExchangeConfigResponseDto',
            'createdAt',
          ),
          updatedAt: BuiltValueNullFieldError.checkNotNull(
            updatedAt,
            r'ExchangeConfigResponseDto',
            'updatedAt',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
