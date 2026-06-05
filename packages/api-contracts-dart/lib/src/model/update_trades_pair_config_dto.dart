//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'update_trades_pair_config_dto.g.dart';

/// UpdateTradesPairConfigDto
///
/// Properties:
/// * [enabled] - 是否启用订阅
/// * [priority] - 优先级（数字越小优先级越高）
/// * [metadata] - 扩展配置（JSON格式）。最大深度5层，最大10KB
/// * [description] - 备注说明
@BuiltValue()
abstract class UpdateTradesPairConfigDto implements Built<UpdateTradesPairConfigDto, UpdateTradesPairConfigDtoBuilder> {
  /// 是否启用订阅
  @BuiltValueField(wireName: r'enabled')
  bool? get enabled;

  /// 优先级（数字越小优先级越高）
  @BuiltValueField(wireName: r'priority')
  num? get priority;

  /// 扩展配置（JSON格式）。最大深度5层，最大10KB
  @BuiltValueField(wireName: r'metadata')
  JsonObject? get metadata;

  /// 备注说明
  @BuiltValueField(wireName: r'description')
  String? get description;

  UpdateTradesPairConfigDto._();

  factory UpdateTradesPairConfigDto([void updates(UpdateTradesPairConfigDtoBuilder b)]) = _$UpdateTradesPairConfigDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(UpdateTradesPairConfigDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<UpdateTradesPairConfigDto> get serializer => _$UpdateTradesPairConfigDtoSerializer();
}

class _$UpdateTradesPairConfigDtoSerializer implements PrimitiveSerializer<UpdateTradesPairConfigDto> {
  @override
  final Iterable<Type> types = const [UpdateTradesPairConfigDto, _$UpdateTradesPairConfigDto];

  @override
  final String wireName = r'UpdateTradesPairConfigDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    UpdateTradesPairConfigDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.enabled != null) {
      yield r'enabled';
      yield serializers.serialize(
        object.enabled,
        specifiedType: const FullType(bool),
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
    UpdateTradesPairConfigDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required UpdateTradesPairConfigDtoBuilder result,
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
  UpdateTradesPairConfigDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = UpdateTradesPairConfigDtoBuilder();
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

