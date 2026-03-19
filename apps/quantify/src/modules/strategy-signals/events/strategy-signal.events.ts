export class TradingSignalCreatedEvent {
  constructor(public readonly signalId: string) {}
}

export class SignalExecutionCompletedEvent {
  constructor(
    public readonly signalId: string,
    public readonly executionId: string,
    public readonly success: boolean,
    public readonly errorMessage?: string,
  ) {}
}
