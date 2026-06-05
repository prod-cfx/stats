//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_data_pull_task_controller_get_registered_keys200_response.g.dart';

/// AdminDataPullTaskControllerGetRegisteredKeys200Response
///
/// Properties:
/// * [keys] 
@BuiltValue()
abstract class AdminDataPullTaskControllerGetRegisteredKeys200Response implements Built<AdminDataPullTaskControllerGetRegisteredKeys200Response, AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder> {
  @BuiltValueField(wireName: r'keys')
  BuiltList<String>? get keys;

  AdminDataPullTaskControllerGetRegisteredKeys200Response._();

  factory AdminDataPullTaskControllerGetRegisteredKeys200Response([void updates(AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder b)]) = _$AdminDataPullTaskControllerGetRegisteredKeys200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminDataPullTaskControllerGetRegisteredKeys200Response> get serializer => _$AdminDataPullTaskControllerGetRegisteredKeys200ResponseSerializer();
}

class _$AdminDataPullTaskControllerGetRegisteredKeys200ResponseSerializer implements PrimitiveSerializer<AdminDataPullTaskControllerGetRegisteredKeys200Response> {
  @override
  final Iterable<Type> types = const [AdminDataPullTaskControllerGetRegisteredKeys200Response, _$AdminDataPullTaskControllerGetRegisteredKeys200Response];

  @override
  final String wireName = r'AdminDataPullTaskControllerGetRegisteredKeys200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminDataPullTaskControllerGetRegisteredKeys200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.keys != null) {
      yield r'keys';
      yield serializers.serialize(
        object.keys,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminDataPullTaskControllerGetRegisteredKeys200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'keys':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.keys.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminDataPullTaskControllerGetRegisteredKeys200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminDataPullTaskControllerGetRegisteredKeys200ResponseBuilder();
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

