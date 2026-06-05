//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'snapshot_total_dto.g.dart';

/// SnapshotTotalDto
///
/// Properties:
/// * [accountValue] - 账户总价值（永续 + 现货，USD）
/// * [perpPercent] - 永续合约占比（%）
/// * [spotPercent] - 现货占比（%）
@BuiltValue()
abstract class SnapshotTotalDto implements Built<SnapshotTotalDto, SnapshotTotalDtoBuilder> {
  /// 账户总价值（永续 + 现货，USD）
  @BuiltValueField(wireName: r'accountValue')
  num get accountValue;

  /// 永续合约占比（%）
  @BuiltValueField(wireName: r'perpPercent')
  num get perpPercent;

  /// 现货占比（%）
  @BuiltValueField(wireName: r'spotPercent')
  num get spotPercent;

  SnapshotTotalDto._();

  factory SnapshotTotalDto([void updates(SnapshotTotalDtoBuilder b)]) = _$SnapshotTotalDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(SnapshotTotalDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<SnapshotTotalDto> get serializer => _$SnapshotTotalDtoSerializer();
}

class _$SnapshotTotalDtoSerializer implements PrimitiveSerializer<SnapshotTotalDto> {
  @override
  final Iterable<Type> types = const [SnapshotTotalDto, _$SnapshotTotalDto];

  @override
  final String wireName = r'SnapshotTotalDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    SnapshotTotalDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'accountValue';
    yield serializers.serialize(
      object.accountValue,
      specifiedType: const FullType(num),
    );
    yield r'perpPercent';
    yield serializers.serialize(
      object.perpPercent,
      specifiedType: const FullType(num),
    );
    yield r'spotPercent';
    yield serializers.serialize(
      object.spotPercent,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    SnapshotTotalDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required SnapshotTotalDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'accountValue':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.accountValue = valueDes;
          break;
        case r'perpPercent':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.perpPercent = valueDes;
          break;
        case r'spotPercent':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.spotPercent = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  SnapshotTotalDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = SnapshotTotalDtoBuilder();
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

