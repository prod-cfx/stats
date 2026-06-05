// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'llm_codegen_start_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const LlmCodegenStartRequestDtoLocaleEnum
_$llmCodegenStartRequestDtoLocaleEnum_zh =
    const LlmCodegenStartRequestDtoLocaleEnum._('zh');
const LlmCodegenStartRequestDtoLocaleEnum
_$llmCodegenStartRequestDtoLocaleEnum_en =
    const LlmCodegenStartRequestDtoLocaleEnum._('en');

LlmCodegenStartRequestDtoLocaleEnum
_$llmCodegenStartRequestDtoLocaleEnumValueOf(String name) {
  switch (name) {
    case 'zh':
      return _$llmCodegenStartRequestDtoLocaleEnum_zh;
    case 'en':
      return _$llmCodegenStartRequestDtoLocaleEnum_en;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<LlmCodegenStartRequestDtoLocaleEnum>
_$llmCodegenStartRequestDtoLocaleEnumValues =
    BuiltSet<LlmCodegenStartRequestDtoLocaleEnum>(
      const <LlmCodegenStartRequestDtoLocaleEnum>[
        _$llmCodegenStartRequestDtoLocaleEnum_zh,
        _$llmCodegenStartRequestDtoLocaleEnum_en,
      ],
    );

Serializer<LlmCodegenStartRequestDtoLocaleEnum>
_$llmCodegenStartRequestDtoLocaleEnumSerializer =
    _$LlmCodegenStartRequestDtoLocaleEnumSerializer();

class _$LlmCodegenStartRequestDtoLocaleEnumSerializer
    implements PrimitiveSerializer<LlmCodegenStartRequestDtoLocaleEnum> {
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
    LlmCodegenStartRequestDtoLocaleEnum,
  ];
  @override
  final String wireName = 'LlmCodegenStartRequestDtoLocaleEnum';

  @override
  Object serialize(
    Serializers serializers,
    LlmCodegenStartRequestDtoLocaleEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  LlmCodegenStartRequestDtoLocaleEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => LlmCodegenStartRequestDtoLocaleEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$LlmCodegenStartRequestDto extends LlmCodegenStartRequestDto {
  @override
  final String? initialMessage;
  @override
  final BuiltMap<String, JsonObject?>? guideConfig;
  @override
  final LlmCodegenStartRequestDtoLocaleEnum? locale;

  factory _$LlmCodegenStartRequestDto([
    void Function(LlmCodegenStartRequestDtoBuilder)? updates,
  ]) => (LlmCodegenStartRequestDtoBuilder()..update(updates))._build();

  _$LlmCodegenStartRequestDto._({
    this.initialMessage,
    this.guideConfig,
    this.locale,
  }) : super._();
  @override
  LlmCodegenStartRequestDto rebuild(
    void Function(LlmCodegenStartRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  LlmCodegenStartRequestDtoBuilder toBuilder() =>
      LlmCodegenStartRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LlmCodegenStartRequestDto &&
        initialMessage == other.initialMessage &&
        guideConfig == other.guideConfig &&
        locale == other.locale;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, initialMessage.hashCode);
    _$hash = $jc(_$hash, guideConfig.hashCode);
    _$hash = $jc(_$hash, locale.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'LlmCodegenStartRequestDto')
          ..add('initialMessage', initialMessage)
          ..add('guideConfig', guideConfig)
          ..add('locale', locale))
        .toString();
  }
}

class LlmCodegenStartRequestDtoBuilder
    implements
        Builder<LlmCodegenStartRequestDto, LlmCodegenStartRequestDtoBuilder> {
  _$LlmCodegenStartRequestDto? _$v;

  String? _initialMessage;
  String? get initialMessage => _$this._initialMessage;
  set initialMessage(String? initialMessage) =>
      _$this._initialMessage = initialMessage;

  MapBuilder<String, JsonObject?>? _guideConfig;
  MapBuilder<String, JsonObject?> get guideConfig =>
      _$this._guideConfig ??= MapBuilder<String, JsonObject?>();
  set guideConfig(MapBuilder<String, JsonObject?>? guideConfig) =>
      _$this._guideConfig = guideConfig;

  LlmCodegenStartRequestDtoLocaleEnum? _locale;
  LlmCodegenStartRequestDtoLocaleEnum? get locale => _$this._locale;
  set locale(LlmCodegenStartRequestDtoLocaleEnum? locale) =>
      _$this._locale = locale;

  LlmCodegenStartRequestDtoBuilder() {
    LlmCodegenStartRequestDto._defaults(this);
  }

  LlmCodegenStartRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _initialMessage = $v.initialMessage;
      _guideConfig = $v.guideConfig?.toBuilder();
      _locale = $v.locale;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LlmCodegenStartRequestDto other) {
    _$v = other as _$LlmCodegenStartRequestDto;
  }

  @override
  void update(void Function(LlmCodegenStartRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  LlmCodegenStartRequestDto build() => _build();

  _$LlmCodegenStartRequestDto _build() {
    _$LlmCodegenStartRequestDto _$result;
    try {
      _$result =
          _$v ??
          _$LlmCodegenStartRequestDto._(
            initialMessage: initialMessage,
            guideConfig: _guideConfig?.build(),
            locale: locale,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'guideConfig';
        _guideConfig?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'LlmCodegenStartRequestDto',
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
