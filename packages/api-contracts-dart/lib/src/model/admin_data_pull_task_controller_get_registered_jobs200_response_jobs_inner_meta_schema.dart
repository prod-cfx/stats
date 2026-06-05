//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_data_pull_task_controller_get_registered_jobs200_response_jobs_inner_meta_schema.g.dart';

/// AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema
///
/// Properties:
/// * [description] 
/// * [fields] 
/// * [example] 
@BuiltValue()
abstract class AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema implements Built<AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema, AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder> {
  @BuiltValueField(wireName: r'description')
  String? get description;

  @BuiltValueField(wireName: r'fields')
  BuiltList<String>? get fields;

  @BuiltValueField(wireName: r'example')
  JsonObject? get example;

  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema._();

  factory AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema([void updates(AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder b)]) = _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema> get serializer => _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaSerializer();
}

class _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaSerializer implements PrimitiveSerializer<AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema> {
  @override
  final Iterable<Type> types = const [AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema, _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema];

  @override
  final String wireName = r'AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.description != null) {
      yield r'description';
      yield serializers.serialize(
        object.description,
        specifiedType: const FullType(String),
      );
    }
    if (object.fields != null) {
      yield r'fields';
      yield serializers.serialize(
        object.fields,
        specifiedType: const FullType(BuiltList, [FullType(String)]),
      );
    }
    if (object.example != null) {
      yield r'example';
      yield serializers.serialize(
        object.example,
        specifiedType: const FullType(JsonObject),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'description':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.description = valueDes;
          break;
        case r'fields':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(String)]),
          ) as BuiltList<String>;
          result.fields.replace(valueDes);
          break;
        case r'example':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(JsonObject),
          ) as JsonObject;
          result.example = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchema deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInnerMetaSchemaBuilder();
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

