import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/ai_strategy_context.dart';
import '../../data/models/backtest_models.dart';

class AiBacktestChatHandoff {
  const AiBacktestChatHandoff({
    required this.result,
    this.strategyContext,
    this.sessionId,
  });

  final BacktestResult result;
  final AiPublishedStrategyContext? strategyContext;
  final String? sessionId;
}

final aiBacktestChatHandoffProvider =
    NotifierProvider<AiBacktestChatHandoffNotifier, AiBacktestChatHandoff?>(
      AiBacktestChatHandoffNotifier.new,
    );

class AiBacktestChatHandoffNotifier extends Notifier<AiBacktestChatHandoff?> {
  @override
  AiBacktestChatHandoff? build() => null;

  void set(AiBacktestChatHandoff handoff) => state = handoff;

  void clear() => state = null;
}
