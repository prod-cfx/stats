//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'admin_data_pull_task_response_dto.g.dart';

/// AdminDataPullTaskResponseDto
///
/// Properties:
/// * [id] - 任务 ID
/// * [key] - 任务唯一标识
/// * [name] - 任务名称
/// * [source_] 
/// * [type] 
/// * [cron] 
/// * [intervalSeconds] 
/// * [enabled] - 是否启用任务
/// * [cursor] 
/// * [lastStatus] 
/// * [lastRunAt] 
/// * [lastSuccessAt] 
/// * [lastError] 
/// * [meta] 
/// * [createdAt] - 任务创建时间
/// * [updatedAt] - 任务更新时间
@BuiltValue()
abstract class AdminDataPullTaskResponseDto implements Built<AdminDataPullTaskResponseDto, AdminDataPullTaskResponseDtoBuilder> {
  /// 任务 ID
  @BuiltValueField(wireName: r'id')
  num get id;

  /// 任务唯一标识
  @BuiltValueField(wireName: r'key')
  String get key;

  /// 任务名称
  @BuiltValueField(wireName: r'name')
  String get name;

  @BuiltValueField(wireName: r'source')
  String? get source_;

  @BuiltValueField(wireName: r'type')
  String? get type;

  @BuiltValueField(wireName: r'cron')
  String? get cron;

  @BuiltValueField(wireName: r'intervalSeconds')
  num? get intervalSeconds;

  /// 是否启用任务
  @BuiltValueField(wireName: r'enabled')
  bool get enabled;

  @BuiltValueField(wireName: r'cursor')
  String? get cursor;

  @BuiltValueField(wireName: r'lastStatus')
  String? get lastStatus;

  @BuiltValueField(wireName: r'lastRunAt')
  DateTime? get lastRunAt;

  @BuiltValueField(wireName: r'lastSuccessAt')
  DateTime? get lastSuccessAt;

  @BuiltValueField(wireName: r'lastError')
  String? get lastError;

  @BuiltValueField(wireName: r'meta')
  JsonObject? get meta;

  /// 任务创建时间
  @BuiltValueField(wireName: r'createdAt')
  DateTime get createdAt;

  /// 任务更新时间
  @BuiltValueField(wireName: r'updatedAt')
  DateTime get updatedAt;

  AdminDataPullTaskResponseDto._();

  factory AdminDataPullTaskResponseDto([void updates(AdminDataPullTaskResponseDtoBuilder b)]) = _$AdminDataPullTaskResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AdminDataPullTaskResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AdminDataPullTaskResponseDto> get serializer => _$AdminDataPullTaskResponseDtoSerializer();
}

class _$AdminDataPullTaskResponseDtoSerializer implements PrimitiveSerializer<AdminDataPullTaskResponseDto> {
  @override
  final Iterable<Type> types = const [AdminDataPullTaskResponseDto, _$AdminDataPullTaskResponseDto];

  @override
  final String wireName = r'AdminDataPullTaskResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AdminDataPullTaskResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(num),
    );
    yield r'key';
    yield serializers.serialize(
      object.key,
      specifiedType: const FullType(String),
    );
    yield r'name';
    yield serializers.serialize(
      object.name,
      specifiedType: const FullType(String),
    );
    if (object.source_ != null) {
      yield r'source';
      yield serializers.serialize(
        object.source_,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.type != null) {
      yield r'type';
      yield serializers.serialize(
        object.type,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.cron != null) {
      yield r'cron';
      yield serializers.serialize(
        object.cron,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.intervalSeconds != null) {
      yield r'intervalSeconds';
      yield serializers.serialize(
        object.intervalSeconds,
        specifiedType: const FullType.nullable(num),
      );
    }
    yield r'enabled';
    yield serializers.serialize(
      object.enabled,
      specifiedType: const FullType(bool),
    );
    if (object.cursor != null) {
      yield r'cursor';
      yield serializers.serialize(
        object.cursor,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.lastStatus != null) {
      yield r'lastStatus';
      yield serializers.serialize(
        object.lastStatus,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.lastRunAt != null) {
      yield r'lastRunAt';
      yield serializers.serialize(
        object.lastRunAt,
        specifiedType: const FullType.nullable(DateTime),
      );
    }
    if (object.lastSuccessAt != null) {
      yield r'lastSuccessAt';
      yield serializers.serialize(
        object.lastSuccessAt,
        specifiedType: const FullType.nullable(DateTime),
      );
    }
    if (object.lastError != null) {
      yield r'lastError';
      yield serializers.serialize(
        object.lastError,
        specifiedType: const FullType.nullable(String),
      );
    }
    if (object.meta != null) {
      yield r'meta';
      yield serializers.serialize(
        object.meta,
        specifiedType: const FullType.nullable(JsonObject),
      );
    }
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(DateTime),
    );
    yield r'updatedAt';
    yield serializers.serialize(
      object.updatedAt,
      specifiedType: const FullType(DateTime),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    AdminDataPullTaskResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AdminDataPullTaskResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.id = valueDes;
          break;
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
        case r'source':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.source_ = valueDes;
          break;
        case r'type':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.type = valueDes;
          break;
        case r'cron':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.cron = valueDes;
          break;
        case r'intervalSeconds':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.intervalSeconds = valueDes;
          break;
        case r'enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.enabled = valueDes;
          break;
        case r'cursor':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.cursor = valueDes;
          break;
        case r'lastStatus':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.lastStatus = valueDes;
          break;
        case r'lastRunAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(DateTime),
          ) as DateTime?;
          if (valueDes == null) continue;
          result.lastRunAt = valueDes;
          break;
        case r'lastSuccessAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(DateTime),
          ) as DateTime?;
          if (valueDes == null) continue;
          result.lastSuccessAt = valueDes;
          break;
        case r'lastError':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.lastError = valueDes;
          break;
        case r'meta':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(JsonObject),
          ) as JsonObject?;
          if (valueDes == null) continue;
          result.meta = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.createdAt = valueDes;
          break;
        case r'updatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.updatedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AdminDataPullTaskResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AdminDataPullTaskResponseDtoBuilder();
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

