//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_admin_data_pull_task_dto.g.dart';

/// CreateAdminDataPullTaskDto
///
/// Properties:
/// * [key] - 任务唯一标识，应与具体 Job 的 key 保持一致
/// * [name] - 任务名称（描述用途）
/// * [source_] - 数据来源标识（例如 binance、newsapi 等）
/// * [type] - 任务类型标识（例如 kline_1m、news_latest 等）
/// * [cron] - Cron 表达式（可选），当前主要使用 intervalSeconds 调度
/// * [intervalSeconds] - 最小执行间隔（秒），用于防止任务过于频繁执行
/// * [enabled] - 是否启用任务
/// * [cursor] - 初始游标（例如起始时间戳、自增 ID 等）
/// * [meta] - 任务级自定义配置参数（JSON），例如不同数据源的过滤条件等
@BuiltValue()
abstract class CreateAdminDataPullTaskDto implements Built<CreateAdminDataPullTaskDto, CreateAdminDataPullTaskDtoBuilder> {
  /// 任务唯一标识，应与具体 Job 的 key 保持一致
  @BuiltValueField(wireName: r'key')
  String get key;

  /// 任务名称（描述用途）
  @BuiltValueField(wireName: r'name')
  String get name;

  /// 数据来源标识（例如 binance、newsapi 等）
  @BuiltValueField(wireName: r'source')
  String? get source_;

  /// 任务类型标识（例如 kline_1m、news_latest 等）
  @BuiltValueField(wireName: r'type')
  String? get type;

  /// Cron 表达式（可选），当前主要使用 intervalSeconds 调度
  @BuiltValueField(wireName: r'cron')
  String? get cron;

  /// 最小执行间隔（秒），用于防止任务过于频繁执行
  @BuiltValueField(wireName: r'intervalSeconds')
  num? get intervalSeconds;

  /// 是否启用任务
  @BuiltValueField(wireName: r'enabled')
  bool? get enabled;

  /// 初始游标（例如起始时间戳、自增 ID 等）
  @BuiltValueField(wireName: r'cursor')
  String? get cursor;

  /// 任务级自定义配置参数（JSON），例如不同数据源的过滤条件等
  @BuiltValueField(wireName: r'meta')
  JsonObject? get meta;

  CreateAdminDataPullTaskDto._();

  factory CreateAdminDataPullTaskDto([void updates(CreateAdminDataPullTaskDtoBuilder b)]) = _$CreateAdminDataPullTaskDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateAdminDataPullTaskDtoBuilder b) => b
      ..enabled = true;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateAdminDataPullTaskDto> get serializer => _$CreateAdminDataPullTaskDtoSerializer();
}

class _$CreateAdminDataPullTaskDtoSerializer implements PrimitiveSerializer<CreateAdminDataPullTaskDto> {
  @override
  final Iterable<Type> types = const [CreateAdminDataPullTaskDto, _$CreateAdminDataPullTaskDto];

  @override
  final String wireName = r'CreateAdminDataPullTaskDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateAdminDataPullTaskDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
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
    CreateAdminDataPullTaskDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateAdminDataPullTaskDtoBuilder result,
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
  CreateAdminDataPullTaskDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateAdminDataPullTaskDtoBuilder();
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

