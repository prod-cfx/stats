//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/admin_data_pull_task_controller_get_registered_jobs200_response_jobs_inner_meta_schema.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_data_pull_task_controller_get_registered_jobs200_response_jobs_inner.g.dart';

/// AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner
///
/// Properties:
/// * [key] 
/// * [name] 
/// * [metaSchema] 
@BuiltValue()
abstract class AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner implements Built<AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner, AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder> {
  @BuiltValueField(wireName: r'key')
  String? get key;

  @BuiltValueField(wireName: r'name')
  String? get name;

  @BuiltValueField(wireName: r'metaSchema')
  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema? get metaSchema;

  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner._();

  factory AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner([void updates(AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder b)]) = _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner> get serializer => _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerSerializer();
}

class _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerSerializer implements PrimitiveSerializer<AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner> {
  @override
  final Iterable<Type> types = const [AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner, _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner];

  @override
  final String wireName = r'AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.key != null) {
      yield r'key';
      yield serializers.serialize(
        object.key,
        specifiedType: const FullType(String),
      );
    }
    if (object.name != null) {
      yield r'name';
      yield serializers.serialize(
        object.name,
        specifiedType: const FullType(String),
      );
    }
    if (object.metaSchema != null) {
      yield r'metaSchema';
      yield serializers.serialize(
        object.metaSchema,
        specifiedType: const FullType.nullable(AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'key':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.key = valueDes;
          break;
        case r'name':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.name = valueDes;
          break;
        case r'metaSchema':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema),
          ) as AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema?;
          if (valueDes == null) continue;
          result.metaSchema.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerBuilder();
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

