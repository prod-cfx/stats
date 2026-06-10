//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'strategy_plaza_official_backtest_equity_point_response_dto.g.dart';

/// StrategyPlazaOfficialBacktestEquityPointResponseDto
///
/// Properties:
/// * [ts] 
/// * [equity] 
@BuiltValue()
abstract class StrategyPlazaOfficialBacktestEquityPointResponseDto implements Built<StrategyPlazaOfficialBacktestEquityPointResponseDto, StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder> {
  @BuiltValueField(wireName: r'ts')
  num get ts;

  @BuiltValueField(wireName: r'equity')
  num get equity;

  StrategyPlazaOfficialBacktestEquityPointResponseDto._();

  factory StrategyPlazaOfficialBacktestEquityPointResponseDto([void updates(StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder b)]) = _$StrategyPlazaOfficialBacktestEquityPointResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<StrategyPlazaOfficialBacktestEquityPointResponseDto> get serializer => _$StrategyPlazaOfficialBacktestEquityPointResponseDtoSerializer();
}

class _$StrategyPlazaOfficialBacktestEquityPointResponseDtoSerializer implements PrimitiveSerializer<StrategyPlazaOfficialBacktestEquityPointResponseDto> {
  @override
  final Iterable<Type> types = const [StrategyPlazaOfficialBacktestEquityPointResponseDto, _$StrategyPlazaOfficialBacktestEquityPointResponseDto];

  @override
  final String wireName = r'StrategyPlazaOfficialBacktestEquityPointResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    StrategyPlazaOfficialBacktestEquityPointResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'ts';
    yield serializers.serialize(
      object.ts,
      specifiedType: const FullType(num),
    );
    yield r'equity';
    yield serializers.serialize(
      object.equity,
      specifiedType: const FullType(num),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    StrategyPlazaOfficialBacktestEquityPointResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'ts':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.ts = valueDes;
          break;
        case r'equity':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.equity = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  StrategyPlazaOfficialBacktestEquityPointResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder();
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

