//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'llm_codegen_continue_request_dto.g.dart';

/// LlmCodegenContinueRequestDto
///
/// Properties:
/// * [message] 
/// * [clarificationAnswers] 
/// * [guideConfig] 
/// * [locale] 
/// * [confirmGenerate] 
/// * [confirmedCanonicalDigest] 
/// * [providerCode] 
/// * [model] 
/// * [temperature] 
/// * [maxTokens] 
@BuiltValue()
abstract class LlmCodegenContinueRequestDto implements Built<LlmCodegenContinueRequestDto, LlmCodegenContinueRequestDtoBuilder> {
  @BuiltValueField(wireName: r'message')
  String get message;

  @BuiltValueField(wireName: r'clarificationAnswers')
  BuiltMap<String, String>? get clarificationAnswers;

  @BuiltValueField(wireName: r'guideConfig')
  BuiltMap<String, JsonObject?>? get guideConfig;

  @BuiltValueField(wireName: r'locale')
  LlmCodegenContinueRequestDtoLocaleEnum? get locale;
  // enum localeEnum {  zh,  en,  };

  @BuiltValueField(wireName: r'confirmGenerate')
  bool? get confirmGenerate;

  @BuiltValueField(wireName: r'confirmedCanonicalDigest')
  String? get confirmedCanonicalDigest;

  @BuiltValueField(wireName: r'providerCode')
  String? get providerCode;

  @BuiltValueField(wireName: r'model')
  String? get model;

  @BuiltValueField(wireName: r'temperature')
  num? get temperature;

  @BuiltValueField(wireName: r'maxTokens')
  num? get maxTokens;

  LlmCodegenContinueRequestDto._();

  factory LlmCodegenContinueRequestDto([void updates(LlmCodegenContinueRequestDtoBuilder b)]) = _$LlmCodegenContinueRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LlmCodegenContinueRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LlmCodegenContinueRequestDto> get serializer => _$LlmCodegenContinueRequestDtoSerializer();
}

class _$LlmCodegenContinueRequestDtoSerializer implements PrimitiveSerializer<LlmCodegenContinueRequestDto> {
  @override
  final Iterable<Type> types = const [LlmCodegenContinueRequestDto, _$LlmCodegenContinueRequestDto];

  @override
  final String wireName = r'LlmCodegenContinueRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LlmCodegenContinueRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'message';
    yield serializers.serialize(
      object.message,
      specifiedType: const FullType(String),
    );
    if (object.clarificationAnswers != null) {
      yield r'clarificationAnswers';
      yield serializers.serialize(
        object.clarificationAnswers,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType(String)]),
      );
    }
    if (object.guideConfig != null) {
      yield r'guideConfig';
      yield serializers.serialize(
        object.guideConfig,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
    if (object.locale != null) {
      yield r'locale';
      yield serializers.serialize(
        object.locale,
        specifiedType: const FullType(LlmCodegenContinueRequestDtoLocaleEnum),
      );
    }
    if (object.confirmGenerate != null) {
      yield r'confirmGenerate';
      yield serializers.serialize(
        object.confirmGenerate,
        specifiedType: const FullType(bool),
      );
    }
    if (object.confirmedCanonicalDigest != null) {
      yield r'confirmedCanonicalDigest';
      yield serializers.serialize(
        object.confirmedCanonicalDigest,
        specifiedType: const FullType(String),
      );
    }
    if (object.providerCode != null) {
      yield r'providerCode';
      yield serializers.serialize(
        object.providerCode,
        specifiedType: const FullType(String),
      );
    }
    if (object.model != null) {
      yield r'model';
      yield serializers.serialize(
        object.model,
        specifiedType: const FullType(String),
      );
    }
    if (object.temperature != null) {
      yield r'temperature';
      yield serializers.serialize(
        object.temperature,
        specifiedType: const FullType(num),
      );
    }
    if (object.maxTokens != null) {
      yield r'maxTokens';
      yield serializers.serialize(
        object.maxTokens,
        specifiedType: const FullType(num),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    LlmCodegenContinueRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LlmCodegenContinueRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'message':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.message = valueDes;
          break;
        case r'clarificationAnswers':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType(String)]),
          ) as BuiltMap<String, String>;
          result.clarificationAnswers.replace(valueDes);
          break;
        case r'guideConfig':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.guideConfig.replace(valueDes);
          break;
        case r'locale':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(LlmCodegenContinueRequestDtoLocaleEnum),
          ) as LlmCodegenContinueRequestDtoLocaleEnum;
          result.locale = valueDes;
          break;
        case r'confirmGenerate':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.confirmGenerate = valueDes;
          break;
        case r'confirmedCanonicalDigest':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.confirmedCanonicalDigest = valueDes;
          break;
        case r'providerCode':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.providerCode = valueDes;
          break;
        case r'model':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.model = valueDes;
          break;
        case r'temperature':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.temperature = valueDes;
          break;
        case r'maxTokens':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.maxTokens = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  LlmCodegenContinueRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LlmCodegenContinueRequestDtoBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}

class LlmCodegenContinueRequestDtoLocaleEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'zh')
  static const LlmCodegenContinueRequestDtoLocaleEnum zh = _$llmCodegenContinueRequestDtoLocaleEnum_zh;
  @BuiltValueEnumConst(wireName: r'en')
  static const LlmCodegenContinueRequestDtoLocaleEnum en = _$llmCodegenContinueRequestDtoLocaleEnum_en;

  static Serializer<LlmCodegenContinueRequestDtoLocaleEnum> get serializer => _$llmCodegenContinueRequestDtoLocaleEnumSerializer;

  const LlmCodegenContinueRequestDtoLocaleEnum._(String name): super(name);

  static BuiltSet<LlmCodegenContinueRequestDtoLocaleEnum> get values => _$llmCodegenContinueRequestDtoLocaleEnumValues;
  static LlmCodegenContinueRequestDtoLocaleEnum valueOf(String name) => _$llmCodegenContinueRequestDtoLocaleEnumValueOf(name);
}

