//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'update_orderbook_pair_config_dto.g.dart';

/// UpdateOrderbookPairConfigDto
///
/// Properties:
/// * [enabled] - 是否启用拉取
/// * [pullIntervalSeconds] - 拉取频率（秒），null 表示使用全局默认值
/// * [depthLevels] - 深度层级（买卖各多少档）
/// * [priority] - 优先级（数字越小优先级越高）
/// * [metadata] - 扩展配置（JSON格式）
/// * [description] - 备注说明
@BuiltValue()
abstract class UpdateOrderbookPairConfigDto implements Built<UpdateOrderbookPairConfigDto, UpdateOrderbookPairConfigDtoBuilder> {
  /// 是否启用拉取
  @BuiltValueField(wireName: r'enabled')
  bool? get enabled;

  /// 拉取频率（秒），null 表示使用全局默认值
  @BuiltValueField(wireName: r'pullIntervalSeconds')
  num? get pullIntervalSeconds;

  /// 深度层级（买卖各多少档）
  @BuiltValueField(wireName: r'depthLevels')
  num? get depthLevels;

  /// 优先级（数字越小优先级越高）
  @BuiltValueField(wireName: r'priority')
  num? get priority;

  /// 扩展配置（JSON格式）
  @BuiltValueField(wireName: r'metadata')
  JsonObject? get metadata;

  /// 备注说明
  @BuiltValueField(wireName: r'description')
  String? get description;

  UpdateOrderbookPairConfigDto._();

  factory UpdateOrderbookPairConfigDto([void updates(UpdateOrderbookPairConfigDtoBuilder b)]) = _$UpdateOrderbookPairConfigDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(UpdateOrderbookPairConfigDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<UpdateOrderbookPairConfigDto> get serializer => _$UpdateOrderbookPairConfigDtoSerializer();
}

class _$UpdateOrderbookPairConfigDtoSerializer implements PrimitiveSerializer<UpdateOrderbookPairConfigDto> {
  @override
  final Iterable<Type> types = const [UpdateOrderbookPairConfigDto, _$UpdateOrderbookPairConfigDto];

  @override
  final String wireName = r'UpdateOrderbookPairConfigDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    UpdateOrderbookPairConfigDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.enabled != null) {
      yield r'enabled';
      yield serializers.serialize(
        object.enabled,
        specifiedType: const FullType(bool),
      );
    }
    if (object.pullIntervalSeconds != null) {
      yield r'pullIntervalSeconds';
      yield serializers.serialize(
        object.pullIntervalSeconds,
        specifiedType: const FullType.nullable(num),
      );
    }
    if (object.depthLevels != null) {
      yield r'depthLevels';
      yield serializers.serialize(
        object.depthLevels,
        specifiedType: const FullType.nullable(num),
      );
    }
    if (object.priority != null) {
      yield r'priority';
      yield serializers.serialize(
        object.priority,
        specifiedType: const FullType(num),
      );
    }
    if (object.metadata != null) {
      yield r'metadata';
      yield serializers.serialize(
        object.metadata,
        specifiedType: const FullType.nullable(JsonObject),
      );
    }
    if (object.description != null) {
      yield r'description';
      yield serializers.serialize(
        object.description,
        specifiedType: const FullType.nullable(String),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    UpdateOrderbookPairConfigDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required UpdateOrderbookPairConfigDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'enabled':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.enabled = valueDes;
          break;
        case r'pullIntervalSeconds':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.pullIntervalSeconds = valueDes;
          break;
        case r'depthLevels':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(num),
          ) as num?;
          if (valueDes == null) continue;
          result.depthLevels = valueDes;
          break;
        case r'priority':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.priority = valueDes;
          break;
        case r'metadata':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(JsonObject),
          ) as JsonObject?;
          if (valueDes == null) continue;
          result.metadata = valueDes;
          break;
        case r'description':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(String),
          ) as String?;
          if (valueDes == null) continue;
          result.description = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  UpdateOrderbookPairConfigDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = UpdateOrderbookPairConfigDtoBuilder();
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

