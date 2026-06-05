//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_create_job_strategy_dto.g.dart';

/// BacktestingCreateJobStrategyDto
///
/// Properties:
/// * [id] 
/// * [protocolVersion] 
/// * [publishedSnapshotId] 
/// * [params] 
@BuiltValue()
abstract class BacktestingCreateJobStrategyDto implements Built<BacktestingCreateJobStrategyDto, BacktestingCreateJobStrategyDtoBuilder> {
  @BuiltValueField(wireName: r'id')
  String? get id;

  @BuiltValueField(wireName: r'protocolVersion')
  BacktestingCreateJobStrategyDtoProtocolVersionEnum get protocolVersion;
  // enum protocolVersionEnum {  v1,  };

  @BuiltValueField(wireName: r'publishedSnapshotId')
  String? get publishedSnapshotId;

  @BuiltValueField(wireName: r'params')
  BuiltMap<String, JsonObject?>? get params;

  BacktestingCreateJobStrategyDto._();

  factory BacktestingCreateJobStrategyDto([void updates(BacktestingCreateJobStrategyDtoBuilder b)]) = _$BacktestingCreateJobStrategyDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingCreateJobStrategyDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingCreateJobStrategyDto> get serializer => _$BacktestingCreateJobStrategyDtoSerializer();
}

class _$BacktestingCreateJobStrategyDtoSerializer implements PrimitiveSerializer<BacktestingCreateJobStrategyDto> {
  @override
  final Iterable<Type> types = const [BacktestingCreateJobStrategyDto, _$BacktestingCreateJobStrategyDto];

  @override
  final String wireName = r'BacktestingCreateJobStrategyDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingCreateJobStrategyDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.id != null) {
      yield r'id';
      yield serializers.serialize(
        object.id,
        specifiedType: const FullType(String),
      );
    }
    yield r'protocolVersion';
    yield serializers.serialize(
      object.protocolVersion,
      specifiedType: const FullType(BacktestingCreateJobStrategyDtoProtocolVersionEnum),
    );
    if (object.publishedSnapshotId != null) {
      yield r'publishedSnapshotId';
      yield serializers.serialize(
        object.publishedSnapshotId,
        specifiedType: const FullType(String),
      );
    }
    if (object.params != null) {
      yield r'params';
      yield serializers.serialize(
        object.params,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobStrategyDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingCreateJobStrategyDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'protocolVersion':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BacktestingCreateJobStrategyDtoProtocolVersionEnum),
          ) as BacktestingCreateJobStrategyDtoProtocolVersionEnum;
          result.protocolVersion = valueDes;
          break;
        case r'publishedSnapshotId':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.publishedSnapshotId = valueDes;
          break;
        case r'params':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.params.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingCreateJobStrategyDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingCreateJobStrategyDtoBuilder();
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

class BacktestingCreateJobStrategyDtoProtocolVersionEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'v1')
  static const BacktestingCreateJobStrategyDtoProtocolVersionEnum v1 = _$backtestingCreateJobStrategyDtoProtocolVersionEnum_v1;

  static Serializer<BacktestingCreateJobStrategyDtoProtocolVersionEnum> get serializer => _$backtestingCreateJobStrategyDtoProtocolVersionEnumSerializer;

  const BacktestingCreateJobStrategyDtoProtocolVersionEnum._(String name): super(name);

  static BuiltSet<BacktestingCreateJobStrategyDtoProtocolVersionEnum> get values => _$backtestingCreateJobStrategyDtoProtocolVersionEnumValues;
  static BacktestingCreateJobStrategyDtoProtocolVersionEnum valueOf(String name) => _$backtestingCreateJobStrategyDtoProtocolVersionEnumValueOf(name);
}

