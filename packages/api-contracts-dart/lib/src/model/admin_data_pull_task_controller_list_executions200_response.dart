//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/admin_data_pull_execution_response_dto.dart';
import 'package:backend_api_contracts/src/model/base_pagination_response_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_data_pull_task_controller_list_executions200_response.g.dart';

/// AdminDataPullTaskControllerListExecutions200Response
///
/// Properties:
/// * [total] - 数据总量
/// * [page] - 当前页码
/// * [limit] - 每页数量
/// * [items] 
@BuiltValue()
abstract class AdminDataPullTaskControllerListExecutions200Response implements BasePaginationResponseDto, Built<AdminDataPullTaskControllerListExecutions200Response, AdminDataPullTaskControllerListExecutions200ResponseBuilder> {
  AdminDataPullTaskControllerListExecutions200Response._();

  factory AdminDataPullTaskControllerListExecutions200Response([void updates(AdminDataPullTaskControllerListExecutions200ResponseBuilder b)]) = _$AdminDataPullTaskControllerListExecutions200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminDataPullTaskControllerListExecutions200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminDataPullTaskControllerListExecutions200Response> get serializer => _$AdminDataPullTaskControllerListExecutions200ResponseSerializer();
}

class _$AdminDataPullTaskControllerListExecutions200ResponseSerializer implements PrimitiveSerializer<AdminDataPullTaskControllerListExecutions200Response> {
  @override
  final Iterable<Type> types = const [AdminDataPullTaskControllerListExecutions200Response, _$AdminDataPullTaskControllerListExecutions200Response];

  @override
  final String wireName = r'AdminDataPullTaskControllerListExecutions200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminDataPullTaskControllerListExecutions200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'limit';
    yield serializers.serialize(
      object.limit,
      specifiedType: const FullType(num),
    );
    yield r'total';
    yield serializers.serialize(
      object.total,
      specifiedType: const FullType(num),
    );
    yield r'page';
    yield serializers.serialize(
      object.page,
      specifiedType: const FullType(num),
    );
    yield r'items';
    yield serializers.serialize(
      object.items,
      specifiedType: const FullType(BuiltList, [FullType(JsonObject)]),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminDataPullTaskControllerListExecutions200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminDataPullTaskControllerListExecutions200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'limit':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.limit = valueDes;
          break;
        case r'total':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.total = valueDes;
          break;
        case r'page':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.page = valueDes;
          break;
        case r'items':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(JsonObject)]),
          ) as BuiltList<JsonObject>;
          result.items.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminDataPullTaskControllerListExecutions200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminDataPullTaskControllerListExecutions200ResponseBuilder();
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

