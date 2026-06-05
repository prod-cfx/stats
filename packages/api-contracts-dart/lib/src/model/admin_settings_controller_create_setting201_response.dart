//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/setting_response_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_settings_controller_create_setting201_response.g.dart';

/// AdminSettingsControllerCreateSetting201Response
///
/// Properties:
/// * [data] 
/// * [message] 
@BuiltValue()
abstract class AdminSettingsControllerCreateSetting201Response implements Built<AdminSettingsControllerCreateSetting201Response, AdminSettingsControllerCreateSetting201ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  SettingResponseDto? get data;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AdminSettingsControllerCreateSetting201Response._();

  factory AdminSettingsControllerCreateSetting201Response([void updates(AdminSettingsControllerCreateSetting201ResponseBuilder b)]) = _$AdminSettingsControllerCreateSetting201Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminSettingsControllerCreateSetting201ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminSettingsControllerCreateSetting201Response> get serializer => _$AdminSettingsControllerCreateSetting201ResponseSerializer();
}

class _$AdminSettingsControllerCreateSetting201ResponseSerializer implements PrimitiveSerializer<AdminSettingsControllerCreateSetting201Response> {
  @override
  final Iterable<Type> types = const [AdminSettingsControllerCreateSetting201Response, _$AdminSettingsControllerCreateSetting201Response];

  @override
  final String wireName = r'AdminSettingsControllerCreateSetting201Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminSettingsControllerCreateSetting201Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(SettingResponseDto),
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
    AdminSettingsControllerCreateSetting201Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminSettingsControllerCreateSetting201ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(SettingResponseDto),
          ) as SettingResponseDto;
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
  AdminSettingsControllerCreateSetting201Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminSettingsControllerCreateSetting201ResponseBuilder();
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

