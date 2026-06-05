//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/admin_data_pull_task_controller_get_registered_jobs200_response_jobs_inner.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_data_pull_task_controller_get_registered_jobs200_response.g.dart';

/// AdminDataPullTaskControllerGetRegisteredJobs200Response
///
/// Properties:
/// * [jobs] 
@BuiltValue()
abstract class AdminDataPullTaskControllerGetRegisteredJobs200Response implements Built<AdminDataPullTaskControllerGetRegisteredJobs200Response, AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder> {
  @BuiltValueField(wireName: r'jobs')
  BuiltList<AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner>? get jobs;

  AdminDataPullTaskControllerGetRegisteredJobs200Response._();

  factory AdminDataPullTaskControllerGetRegisteredJobs200Response([void updates(AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder b)]) = _$AdminDataPullTaskControllerGetRegisteredJobs200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminDataPullTaskControllerGetRegisteredJobs200Response> get serializer => _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseSerializer();
}

class _$AdminDataPullTaskControllerGetRegisteredJobs200ResponseSerializer implements PrimitiveSerializer<AdminDataPullTaskControllerGetRegisteredJobs200Response> {
  @override
  final Iterable<Type> types = const [AdminDataPullTaskControllerGetRegisteredJobs200Response, _$AdminDataPullTaskControllerGetRegisteredJobs200Response];

  @override
  final String wireName = r'AdminDataPullTaskControllerGetRegisteredJobs200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminDataPullTaskControllerGetRegisteredJobs200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.jobs != null) {
      yield r'jobs';
      yield serializers.serialize(
        object.jobs,
        specifiedType: const FullType(BuiltList, [FullType(AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminDataPullTaskControllerGetRegisteredJobs200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'jobs':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner)]),
          ) as BuiltList<AdminDataPullTaskControllerGetRegisteredJobs200ResponseJobsInner>;
          result.jobs.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminDataPullTaskControllerGetRegisteredJobs200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminDataPullTaskControllerGetRegisteredJobs200ResponseBuilder();
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

