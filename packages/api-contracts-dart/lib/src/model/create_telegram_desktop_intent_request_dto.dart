//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_telegram_desktop_intent_request_dto.g.dart';

/// CreateTelegramDesktopIntentRequestDto
///
/// Properties:
/// * [intent] 
/// * [lng] 
/// * [redirect] - 登录成功后回跳路径，仅允许站内绝对路径，例如 /zh/ai-quant
@BuiltValue()
abstract class CreateTelegramDesktopIntentRequestDto implements Built<CreateTelegramDesktopIntentRequestDto, CreateTelegramDesktopIntentRequestDtoBuilder> {
  @BuiltValueField(wireName: r'intent')
  CreateTelegramDesktopIntentRequestDtoIntentEnum? get intent;
  // enum intentEnum {  login,  bind,  };

  @BuiltValueField(wireName: r'lng')
  CreateTelegramDesktopIntentRequestDtoLngEnum? get lng;
  // enum lngEnum {  zh,  en,  };

  /// 登录成功后回跳路径，仅允许站内绝对路径，例如 /zh/ai-quant
  @BuiltValueField(wireName: r'redirect')
  String? get redirect;

  CreateTelegramDesktopIntentRequestDto._();

  factory CreateTelegramDesktopIntentRequestDto([void updates(CreateTelegramDesktopIntentRequestDtoBuilder b)]) = _$CreateTelegramDesktopIntentRequestDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateTelegramDesktopIntentRequestDtoBuilder b) => b
      ..intent = CreateTelegramDesktopIntentRequestDtoIntentEnum.valueOf('login')
      ..lng = CreateTelegramDesktopIntentRequestDtoLngEnum.valueOf('zh');

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateTelegramDesktopIntentRequestDto> get serializer => _$CreateTelegramDesktopIntentRequestDtoSerializer();
}

class _$CreateTelegramDesktopIntentRequestDtoSerializer implements PrimitiveSerializer<CreateTelegramDesktopIntentRequestDto> {
  @override
  final Iterable<Type> types = const [CreateTelegramDesktopIntentRequestDto, _$CreateTelegramDesktopIntentRequestDto];

  @override
  final String wireName = r'CreateTelegramDesktopIntentRequestDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateTelegramDesktopIntentRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.intent != null) {
      yield r'intent';
      yield serializers.serialize(
        object.intent,
        specifiedType: const FullType(CreateTelegramDesktopIntentRequestDtoIntentEnum),
      );
    }
    if (object.lng != null) {
      yield r'lng';
      yield serializers.serialize(
        object.lng,
        specifiedType: const FullType(CreateTelegramDesktopIntentRequestDtoLngEnum),
      );
    }
    if (object.redirect != null) {
      yield r'redirect';
      yield serializers.serialize(
        object.redirect,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateTelegramDesktopIntentRequestDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateTelegramDesktopIntentRequestDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'intent':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(CreateTelegramDesktopIntentRequestDtoIntentEnum),
          ) as CreateTelegramDesktopIntentRequestDtoIntentEnum;
          result.intent = valueDes;
          break;
        case r'lng':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(CreateTelegramDesktopIntentRequestDtoLngEnum),
          ) as CreateTelegramDesktopIntentRequestDtoLngEnum;
          result.lng = valueDes;
          break;
        case r'redirect':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.redirect = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateTelegramDesktopIntentRequestDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateTelegramDesktopIntentRequestDtoBuilder();
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

class CreateTelegramDesktopIntentRequestDtoIntentEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'login')
  static const CreateTelegramDesktopIntentRequestDtoIntentEnum login = _$createTelegramDesktopIntentRequestDtoIntentEnum_login;
  @BuiltValueEnumConst(wireName: r'bind')
  static const CreateTelegramDesktopIntentRequestDtoIntentEnum bind = _$createTelegramDesktopIntentRequestDtoIntentEnum_bind;

  static Serializer<CreateTelegramDesktopIntentRequestDtoIntentEnum> get serializer => _$createTelegramDesktopIntentRequestDtoIntentEnumSerializer;

  const CreateTelegramDesktopIntentRequestDtoIntentEnum._(String name): super(name);

  static BuiltSet<CreateTelegramDesktopIntentRequestDtoIntentEnum> get values => _$createTelegramDesktopIntentRequestDtoIntentEnumValues;
  static CreateTelegramDesktopIntentRequestDtoIntentEnum valueOf(String name) => _$createTelegramDesktopIntentRequestDtoIntentEnumValueOf(name);
}

class CreateTelegramDesktopIntentRequestDtoLngEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'zh')
  static const CreateTelegramDesktopIntentRequestDtoLngEnum zh = _$createTelegramDesktopIntentRequestDtoLngEnum_zh;
  @BuiltValueEnumConst(wireName: r'en')
  static const CreateTelegramDesktopIntentRequestDtoLngEnum en = _$createTelegramDesktopIntentRequestDtoLngEnum_en;

  static Serializer<CreateTelegramDesktopIntentRequestDtoLngEnum> get serializer => _$createTelegramDesktopIntentRequestDtoLngEnumSerializer;

  const CreateTelegramDesktopIntentRequestDtoLngEnum._(String name): super(name);

  static BuiltSet<CreateTelegramDesktopIntentRequestDtoLngEnum> get values => _$createTelegramDesktopIntentRequestDtoLngEnumValues;
  static CreateTelegramDesktopIntentRequestDtoLngEnum valueOf(String name) => _$createTelegramDesktopIntentRequestDtoLngEnumValueOf(name);
}

