//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'update_admin_data_pull_task_dto.g.dart';

/// UpdateAdminDataPullTaskDto
///
/// Properties:
/// * [name] - 任务名称（描述用途）
/// * [source_] - 数据来源标识
/// * [type] - 任务类型标识
/// * [cron] - Cron 表达式
/// * [intervalSeconds] - 最小执行间隔（秒）
/// * [enabled] - 是否启用任务
/// * [cursor] - 当前游标（强制重置时使用）
/// * [meta] - 任务级自定义配置参数（JSON），将覆盖原有 meta
@BuiltValue()
abstract class UpdateAdminDataPullTaskDto implements Built<UpdateAdminDataPullTaskDto, UpdateAdminDataPullTaskDtoBuilder> {
  /// 任务名称（描述用途）
  @BuiltValueField(wireName: r'name')
  String? get name;

  /// 数据来源标识
  @BuiltValueField(wireName: r'source')
  String? get source_;

  /// 任务类型标识
  @BuiltValueField(wireName: r'type')
  String? get type;

  /// Cron 表达式
  @BuiltValueField(wireName: r'cron')
  String? get cron;

  /// 最小执行间隔（秒）
  @BuiltValueField(wireName: r'intervalSeconds')
  num? get intervalSeconds;

  /// 是否启用任务
  @BuiltValueField(wireName: r'enabled')
  bool? get enabled;

  /// 当前游标（强制重置时使用）
  @BuiltValueField(wireName: r'cursor')
  String? get cursor;

  /// 任务级自定义配置参数（JSON），将覆盖原有 meta
  @BuiltValueField(wireName: r'meta')
  JsonObject? get meta;

  UpdateAdminDataPullTaskDto._();

  factory UpdateAdminDataPullTaskDto([void updates(UpdateAdminDataPullTaskDtoBuilder b)]) = _$UpdateAdminDataPullTaskDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(UpdateAdminDataPullTaskDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<UpdateAdminDataPullTaskDto> get serializer => _$UpdateAdminDataPullTaskDtoSerializer();
}

class _$UpdateAdminDataPullTaskDtoSerializer implements PrimitiveSerializer<UpdateAdminDataPullTaskDto> {
  @override
  final Iterable<Type> types = const [UpdateAdminDataPullTaskDto, _$UpdateAdminDataPullTaskDto];

  @override
  final String wireName = r'UpdateAdminDataPullTaskDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    UpdateAdminDataPullTaskDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.name != null) {
      yield r'name';
      yield serializers.serialize(
        object.name,
        specifiedType: const FullType(String),
      );
    }
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
    if (object.enabled != null) {
      yield r'enabled';
      yield serializers.serialize(
        object.enabled,
        specifiedType: const FullType(bool),
      );
    }
    if (object.cursor != null) {
      yield r'cursor';
      yield serializers.serialize(
        object.cursor,
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
  }

  @override
  Object serialize(
    Serializers serializers,
    UpdateAdminDataPullTaskDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required UpdateAdminDataPullTaskDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
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
        case r'meta':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(JsonObject),
          ) as JsonObject?;
          if (valueDes == null) continue;
          result.meta = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  UpdateAdminDataPullTaskDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = UpdateAdminDataPullTaskDtoBuilder();
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

