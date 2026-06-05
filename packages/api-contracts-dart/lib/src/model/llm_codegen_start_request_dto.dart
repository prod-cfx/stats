//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'llm_codegen_start_request_dto.g.dart';

/// LlmCodegenStartRequestDto
///
/// Properties:
/// * [initialMessage] 
/// * [guideConfig] 
/// * [locale] 
@BuiltValue()
abstract class LlmCodegenStartRequestDto implements Built<LlmCodegenStartRequestDto, LlmCodegenStartRequestDtoBuilder> {
  @BuiltValueField(wireName: r'initialMessage')
  String? get initialMessage;

  @BuiltValueField(wireName: r'guideConfig')
  BuiltMap<String, JsonObject?>? get guideConfig;

  @BuiltValueField(wireName: r'locale')
  LlmCodegenStartRequestDtoLocaleEnum? get locale;
  // enum localeEnum {  zh,  en,  };

  LlmCodegenStartRequestDto._();

  factory LlmCodegenStartRequestDto([void updates(LlmCodegenStartRequestDtoBuilder b)]) = _$LlmCodegenStartRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(LlmCodegenStartRequestDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<LlmCodegenStartRequestDto> get serializer => _$LlmCodegenStartRequestDtoSerializer();
}

class _$LlmCodegenStartRequestDtoSerializer implements PrimitiveSerializer<LlmCodegenStartRequestDto> {
  @override
  final Iterable<Type> types = const [LlmCodegenStartRequestDto, _$LlmCodegenStartRequestDto];

  @override
  final String wireName = r'LlmCodegenStartRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    LlmCodegenStartRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.initialMessage != null) {
      yield r'initialMessage';
      yield serializers.serialize(
        object.initialMessage,
        specifiedType: const FullType(String),
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
        specifiedType: const FullType(LlmCodegenStartRequestDtoLocaleEnum),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    LlmCodegenStartRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required LlmCodegenStartRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'initialMessage':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.initialMessage = valueDes;
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
            specifiedType: const FullType(LlmCodegenStartRequestDtoLocaleEnum),
          ) as LlmCodegenStartRequestDtoLocaleEnum;
          result.locale = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  LlmCodegenStartRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = LlmCodegenStartRequestDtoBuilder();
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

class LlmCodegenStartRequestDtoLocaleEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'zh')
  static const LlmCodegenStartRequestDtoLocaleEnum zh = _$llmCodegenStartRequestDtoLocaleEnum_zh;
  @BuiltValueEnumConst(wireName: r'en')
  static const LlmCodegenStartRequestDtoLocaleEnum en = _$llmCodegenStartRequestDtoLocaleEnum_en;

  static Serializer<LlmCodegenStartRequestDtoLocaleEnum> get serializer => _$llmCodegenStartRequestDtoLocaleEnumSerializer;

  const LlmCodegenStartRequestDtoLocaleEnum._(String name): super(name);

  static BuiltSet<LlmCodegenStartRequestDtoLocaleEnum> get values => _$llmCodegenStartRequestDtoLocaleEnumValues;
  static LlmCodegenStartRequestDtoLocaleEnum valueOf(String name) => _$llmCodegenStartRequestDtoLocaleEnumValueOf(name);
}

