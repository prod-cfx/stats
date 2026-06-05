// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'llm_codegen_continue_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const LlmCodegenContinueRequestDtoLocaleEnum
_$llmCodegenContinueRequestDtoLocaleEnum_zh =
    const LlmCodegenContinueRequestDtoLocaleEnum._('zh');
const LlmCodegenContinueRequestDtoLocaleEnum
_$llmCodegenContinueRequestDtoLocaleEnum_en =
    const LlmCodegenContinueRequestDtoLocaleEnum._('en');

LlmCodegenContinueRequestDtoLocaleEnum
_$llmCodegenContinueRequestDtoLocaleEnumValueOf(String name) {
  switch (name) {
    case 'zh':
      return _$llmCodegenContinueRequestDtoLocaleEnum_zh;
    case 'en':
      return _$llmCodegenContinueRequestDtoLocaleEnum_en;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<LlmCodegenContinueRequestDtoLocaleEnum>
_$llmCodegenContinueRequestDtoLocaleEnumValues =
    BuiltSet<LlmCodegenContinueRequestDtoLocaleEnum>(
      const <LlmCodegenContinueRequestDtoLocaleEnum>[
        _$llmCodegenContinueRequestDtoLocaleEnum_zh,
        _$llmCodegenContinueRequestDtoLocaleEnum_en,
      ],
    );

Serializer<LlmCodegenContinueRequestDtoLocaleEnum>
_$llmCodegenContinueRequestDtoLocaleEnumSerializer =
    _$LlmCodegenContinueRequestDtoLocaleEnumSerializer();

class _$LlmCodegenContinueRequestDtoLocaleEnumSerializer
    implements PrimitiveSerializer<LlmCodegenContinueRequestDtoLocaleEnum> {
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
    LlmCodegenContinueRequestDtoLocaleEnum,
  ];
  @override
  final String wireName = 'LlmCodegenContinueRequestDtoLocaleEnum';

  @override
  Object serialize(
    Serializers serializers,
    LlmCodegenContinueRequestDtoLocaleEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  LlmCodegenContinueRequestDtoLocaleEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => LlmCodegenContinueRequestDtoLocaleEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$LlmCodegenContinueRequestDto extends LlmCodegenContinueRequestDto {
  @override
  final String message;
  @override
  final BuiltMap<String, String>? clarificationAnswers;
  @override
  final BuiltMap<String, JsonObject?>? guideConfig;
  @override
  final LlmCodegenContinueRequestDtoLocaleEnum? locale;
  @override
  final bool? confirmGenerate;
  @override
  final String? confirmedCanonicalDigest;
  @override
  final String? providerCode;
  @override
  final String? model;
  @override
  final num? temperature;
  @override
  final num? maxTokens;

  factory _$LlmCodegenContinueRequestDto([
    void Function(LlmCodegenContinueRequestDtoBuilder)? updates,
  ]) => (LlmCodegenContinueRequestDtoBuilder()..update(updates))._build();

  _$LlmCodegenContinueRequestDto._({
    required this.message,
    this.clarificationAnswers,
    this.guideConfig,
    this.locale,
    this.confirmGenerate,
    this.confirmedCanonicalDigest,
    this.providerCode,
    this.model,
    this.temperature,
    this.maxTokens,
  }) : super._();
  @override
  LlmCodegenContinueRequestDto rebuild(
    void Function(LlmCodegenContinueRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  LlmCodegenContinueRequestDtoBuilder toBuilder() =>
      LlmCodegenContinueRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LlmCodegenContinueRequestDto &&
        message == other.message &&
        clarificationAnswers == other.clarificationAnswers &&
        guideConfig == other.guideConfig &&
        locale == other.locale &&
        confirmGenerate == other.confirmGenerate &&
        confirmedCanonicalDigest == other.confirmedCanonicalDigest &&
        providerCode == other.providerCode &&
        model == other.model &&
        temperature == other.temperature &&
        maxTokens == other.maxTokens;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, message.hashCode);
    _$hash = $jc(_$hash, clarificationAnswers.hashCode);
    _$hash = $jc(_$hash, guideConfig.hashCode);
    _$hash = $jc(_$hash, locale.hashCode);
    _$hash = $jc(_$hash, confirmGenerate.hashCode);
    _$hash = $jc(_$hash, confirmedCanonicalDigest.hashCode);
    _$hash = $jc(_$hash, providerCode.hashCode);
    _$hash = $jc(_$hash, model.hashCode);
    _$hash = $jc(_$hash, temperature.hashCode);
    _$hash = $jc(_$hash, maxTokens.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'LlmCodegenContinueRequestDto')
          ..add('message', message)
          ..add('clarificationAnswers', clarificationAnswers)
          ..add('guideConfig', guideConfig)
          ..add('locale', locale)
          ..add('confirmGenerate', confirmGenerate)
          ..add('confirmedCanonicalDigest', confirmedCanonicalDigest)
          ..add('providerCode', providerCode)
          ..add('model', model)
          ..add('temperature', temperature)
          ..add('maxTokens', maxTokens))
        .toString();
  }
}

class LlmCodegenContinueRequestDtoBuilder
    implements
        Builder<
          LlmCodegenContinueRequestDto,
          LlmCodegenContinueRequestDtoBuilder
        > {
  _$LlmCodegenContinueRequestDto? _$v;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  MapBuilder<String, String>? _clarificationAnswers;
  MapBuilder<String, String> get clarificationAnswers =>
      _$this._clarificationAnswers ??= MapBuilder<String, String>();
  set clarificationAnswers(MapBuilder<String, String>? clarificationAnswers) =>
      _$this._clarificationAnswers = clarificationAnswers;

  MapBuilder<String, JsonObject?>? _guideConfig;
  MapBuilder<String, JsonObject?> get guideConfig =>
      _$this._guideConfig ??= MapBuilder<String, JsonObject?>();
  set guideConfig(MapBuilder<String, JsonObject?>? guideConfig) =>
      _$this._guideConfig = guideConfig;

  LlmCodegenContinueRequestDtoLocaleEnum? _locale;
  LlmCodegenContinueRequestDtoLocaleEnum? get locale => _$this._locale;
  set locale(LlmCodegenContinueRequestDtoLocaleEnum? locale) =>
      _$this._locale = locale;

  bool? _confirmGenerate;
  bool? get confirmGenerate => _$this._confirmGenerate;
  set confirmGenerate(bool? confirmGenerate) =>
      _$this._confirmGenerate = confirmGenerate;

  String? _confirmedCanonicalDigest;
  String? get confirmedCanonicalDigest => _$this._confirmedCanonicalDigest;
  set confirmedCanonicalDigest(String? confirmedCanonicalDigest) =>
      _$this._confirmedCanonicalDigest = confirmedCanonicalDigest;

  String? _providerCode;
  String? get providerCode => _$this._providerCode;
  set providerCode(String? providerCode) => _$this._providerCode = providerCode;

  String? _model;
  String? get model => _$this._model;
  set model(String? model) => _$this._model = model;

  num? _temperature;
  num? get temperature => _$this._temperature;
  set temperature(num? temperature) => _$this._temperature = temperature;

  num? _maxTokens;
  num? get maxTokens => _$this._maxTokens;
  set maxTokens(num? maxTokens) => _$this._maxTokens = maxTokens;

  LlmCodegenContinueRequestDtoBuilder() {
    LlmCodegenContinueRequestDto._defaults(this);
  }

  LlmCodegenContinueRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _message = $v.message;
      _clarificationAnswers = $v.clarificationAnswers?.toBuilder();
      _guideConfig = $v.guideConfig?.toBuilder();
      _locale = $v.locale;
      _confirmGenerate = $v.confirmGenerate;
      _confirmedCanonicalDigest = $v.confirmedCanonicalDigest;
      _providerCode = $v.providerCode;
      _model = $v.model;
      _temperature = $v.temperature;
      _maxTokens = $v.maxTokens;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LlmCodegenContinueRequestDto other) {
    _$v = other as _$LlmCodegenContinueRequestDto;
  }

  @override
  void update(void Function(LlmCodegenContinueRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  LlmCodegenContinueRequestDto build() => _build();

  _$LlmCodegenContinueRequestDto _build() {
    _$LlmCodegenContinueRequestDto _$result;
    try {
      _$result =
          _$v ??
          _$LlmCodegenContinueRequestDto._(
            message: BuiltValueNullFieldError.checkNotNull(
              message,
              r'LlmCodegenContinueRequestDto',
              'message',
            ),
            clarificationAnswers: _clarificationAnswers?.build(),
            guideConfig: _guideConfig?.build(),
            locale: locale,
            confirmGenerate: confirmGenerate,
            confirmedCanonicalDigest: confirmedCanonicalDigest,
            providerCode: providerCode,
            model: model,
            temperature: temperature,
            maxTokens: maxTokens,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'clarificationAnswers';
        _clarificationAnswers?.build();
        _$failedField = 'guideConfig';
        _guideConfig?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'LlmCodegenContinueRequestDto',
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
