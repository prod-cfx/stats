//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/setting_response_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_settings_controller_get_all_settings200_response.g.dart';

/// AdminSettingsControllerGetAllSettings200Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AdminSettingsControllerGetAllSettings200Response implements Built<AdminSettingsControllerGetAllSettings200Response, AdminSettingsControllerGetAllSettings200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  BuiltList<SettingResponseDto>? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AdminSettingsControllerGetAllSettings200Response._();

  factory AdminSettingsControllerGetAllSettings200Response([void updates(AdminSettingsControllerGetAllSettings200ResponseBuilder b)]) = _$AdminSettingsControllerGetAllSettings200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminSettingsControllerGetAllSettings200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminSettingsControllerGetAllSettings200Response> get serializer => _$AdminSettingsControllerGetAllSettings200ResponseSerializer();
}

class _$AdminSettingsControllerGetAllSettings200ResponseSerializer implements PrimitiveSerializer<AdminSettingsControllerGetAllSettings200Response> {
  @override
  final Iterable<Type> types = const [AdminSettingsControllerGetAllSettings200Response, _$AdminSettingsControllerGetAllSettings200Response];

  @override
  final String wireName = r'AdminSettingsControllerGetAllSettings200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminSettingsControllerGetAllSettings200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(BuiltList, [FullType(SettingResponseDto)]),
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
    AdminSettingsControllerGetAllSettings200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminSettingsControllerGetAllSettings200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(SettingResponseDto)]),
          ) as BuiltList<SettingResponseDto>;
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
  AdminSettingsControllerGetAllSettings200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminSettingsControllerGetAllSettings200ResponseBuilder();
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

