//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/admin_settings_controller_reload_settings200_response_data.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_settings_controller_reload_settings200_response.g.dart';

/// AdminSettingsControllerReloadSettings200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AdminSettingsControllerReloadSettings200Response implements Built<AdminSettingsControllerReloadSettings200Response, AdminSettingsControllerReloadSettings200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  AdminSettingsControllerReloadSettings200ResponseData? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AdminSettingsControllerReloadSettings200Response._();

  factory AdminSettingsControllerReloadSettings200Response([void updates(AdminSettingsControllerReloadSettings200ResponseBuilder b)]) = _$AdminSettingsControllerReloadSettings200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminSettingsControllerReloadSettings200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminSettingsControllerReloadSettings200Response> get serializer => _$AdminSettingsControllerReloadSettings200ResponseSerializer();
}

class _$AdminSettingsControllerReloadSettings200ResponseSerializer implements PrimitiveSerializer<AdminSettingsControllerReloadSettings200Response> {
  @override
  final Iterable<Type> types = const [AdminSettingsControllerReloadSettings200Response, _$AdminSettingsControllerReloadSettings200Response];

  @override
  final String wireName = r'AdminSettingsControllerReloadSettings200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminSettingsControllerReloadSettings200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(AdminSettingsControllerReloadSettings200ResponseData),
      );
    }
    if (object.message != null) {
      yield r'message';
      yield serializers.serialize(
        object.message,
        specifiedType: const FullType(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminSettingsControllerReloadSettings200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminSettingsControllerReloadSettings200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AdminSettingsControllerReloadSettings200ResponseData),
          ) as AdminSettingsControllerReloadSettings200ResponseData;
          result.data.replace(valueDes);
          break;
        case r'message':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.message = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminSettingsControllerReloadSettings200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminSettingsControllerReloadSettings200ResponseBuilder();
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

