//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_settings_controller_reload_settings200_response_data.g.dart';

/// AdminSettingsControllerReloadSettings200ResponseData
///
/// Properties:
/// * [success] 
@BuiltValue()
abstract class AdminSettingsControllerReloadSettings200ResponseData implements Built<AdminSettingsControllerReloadSettings200ResponseData, AdminSettingsControllerReloadSettings200ResponseDataBuilder> {
  @BuiltValueField(wireName: r'success')
  bool? get success;

  AdminSettingsControllerReloadSettings200ResponseData._();

  factory AdminSettingsControllerReloadSettings200ResponseData([void updates(AdminSettingsControllerReloadSettings200ResponseDataBuilder b)]) = _$AdminSettingsControllerReloadSettings200ResponseData;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminSettingsControllerReloadSettings200ResponseDataBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminSettingsControllerReloadSettings200ResponseData> get serializer => _$AdminSettingsControllerReloadSettings200ResponseDataSerializer();
}

class _$AdminSettingsControllerReloadSettings200ResponseDataSerializer implements PrimitiveSerializer<AdminSettingsControllerReloadSettings200ResponseData> {
  @override
  final Iterable<Type> types = const [AdminSettingsControllerReloadSettings200ResponseData, _$AdminSettingsControllerReloadSettings200ResponseData];

  @override
  final String wireName = r'AdminSettingsControllerReloadSettings200ResponseData';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminSettingsControllerReloadSettings200ResponseData object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.success != null) {
      yield r'success';
      yield serializers.serialize(
        object.success,
        specifiedType: const FullType(bool),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminSettingsControllerReloadSettings200ResponseData object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminSettingsControllerReloadSettings200ResponseDataBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'success':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.success = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminSettingsControllerReloadSettings200ResponseData deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminSettingsControllerReloadSettings200ResponseDataBuilder();
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

