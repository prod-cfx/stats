//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_data_pull_task_controller_interrupt_task200_response.g.dart';

/// AdminDataPullTaskControllerInterruptTask200Response
///
/// Properties:
/// * [success] 
/// * [message] 
@BuiltValue()
abstract class AdminDataPullTaskControllerInterruptTask200Response implements Built<AdminDataPullTaskControllerInterruptTask200Response, AdminDataPullTaskControllerInterruptTask200ResponseBuilder> {
  @BuiltValueField(wireName: r'success')
  bool? get success;

  @BuiltValueField(wireName: r'message')
  String? get message;

  AdminDataPullTaskControllerInterruptTask200Response._();

  factory AdminDataPullTaskControllerInterruptTask200Response([void updates(AdminDataPullTaskControllerInterruptTask200ResponseBuilder b)]) = _$AdminDataPullTaskControllerInterruptTask200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminDataPullTaskControllerInterruptTask200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminDataPullTaskControllerInterruptTask200Response> get serializer => _$AdminDataPullTaskControllerInterruptTask200ResponseSerializer();
}

class _$AdminDataPullTaskControllerInterruptTask200ResponseSerializer implements PrimitiveSerializer<AdminDataPullTaskControllerInterruptTask200Response> {
  @override
  final Iterable<Type> types = const [AdminDataPullTaskControllerInterruptTask200Response, _$AdminDataPullTaskControllerInterruptTask200Response];

  @override
  final String wireName = r'AdminDataPullTaskControllerInterruptTask200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminDataPullTaskControllerInterruptTask200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.success != null) {
      yield r'success';
      yield serializers.serialize(
        object.success,
        specifiedType: const FullType(bool),
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
    AdminDataPullTaskControllerInterruptTask200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminDataPullTaskControllerInterruptTask200ResponseBuilder result,
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
  AdminDataPullTaskControllerInterruptTask200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminDataPullTaskControllerInterruptTask200ResponseBuilder();
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

