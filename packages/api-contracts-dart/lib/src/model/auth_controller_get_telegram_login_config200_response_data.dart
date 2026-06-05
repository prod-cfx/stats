//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'auth_controller_get_telegram_login_config200_response_data.g.dart';

/// AuthControllerGetTelegramLoginConfig200ResponseData
///
/// Properties:
/// * [botName] 
/// * [betaCodeGateEnabled] 
@BuiltValue()
abstract class AuthControllerGetTelegramLoginConfig200ResponseData implements Built<AuthControllerGetTelegramLoginConfig200ResponseData, AuthControllerGetTelegramLoginConfig200ResponseDataBuilder> {
  @BuiltValueField(wireName: r'botName')
  String? get botName;

  @BuiltValueField(wireName: r'betaCodeGateEnabled')
  bool get betaCodeGateEnabled;

  AuthControllerGetTelegramLoginConfig200ResponseData._();

  factory AuthControllerGetTelegramLoginConfig200ResponseData([void updates(AuthControllerGetTelegramLoginConfig200ResponseDataBuilder b)]) = _$AuthControllerGetTelegramLoginConfig200ResponseData;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AuthControllerGetTelegramLoginConfig200ResponseDataBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AuthControllerGetTelegramLoginConfig200ResponseData> get serializer => _$AuthControllerGetTelegramLoginConfig200ResponseDataSerializer();
}

class _$AuthControllerGetTelegramLoginConfig200ResponseDataSerializer implements PrimitiveSerializer<AuthControllerGetTelegramLoginConfig200ResponseData> {
  @override
  final Iterable<Type> types = const [AuthControllerGetTelegramLoginConfig200ResponseData, _$AuthControllerGetTelegramLoginConfig200ResponseData];

  @override
  final String wireName = r'AuthControllerGetTelegramLoginConfig200ResponseData';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AuthControllerGetTelegramLoginConfig200ResponseData object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'botName';
    yield object.botName == null ? null : serializers.serialize(
      object.botName,
      specifiedType: const FullType.nullable(String),
    );
    yield r'betaCodeGateEnabled';
    yield serializers.serialize(
      object.betaCodeGateEnabled,
      specifiedType: const FullType(bool),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AuthControllerGetTelegramLoginConfig200ResponseData object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AuthControllerGetTelegramLoginConfig200ResponseDataBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'botName':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.botName = valueDes;
          break;
        case r'betaCodeGateEnabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.betaCodeGateEnabled = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AuthControllerGetTelegramLoginConfig200ResponseData deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AuthControllerGetTelegramLoginConfig200ResponseDataBuilder();
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

