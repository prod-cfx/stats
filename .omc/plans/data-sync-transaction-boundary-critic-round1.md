# Plan Critic Round 1: Data Sync Transaction Boundary

## Verdict

Pass. Critical=0, Major=0.

## Checks

- PR topology: single PR is valid for Track B because there is no schema change, no writer/consumer data dependency split, and no irreversible migration.
- Transaction boundary: plan moves the shared data-sync boundary to `DataSyncOrchestrator`, matching non-HTTP convention and avoiding per-job policy choices.
- Job wrappers: plan includes static regression to prevent `withAfterCommit(` in production data-sync job files.
- Independent cron: plan explicitly handles `CleanupOldTradesJob.handleCron()` separately because it is outside orchestrator.
- Tests: plan follows TDD with RED/GREEN steps for orchestrator, static regression, and cleanup cron.
- Build/lint: plan includes required `dx lint`, `dx build backend --dev`, and focused unit tests.

## Minor Notes

- Orchestrator wrapper should wrap only `job.run(ctx)`, not execution record creation or success/failure updates, to preserve current status write semantics outside the job transaction boundary.
- Constructor cleanup must remove now-unused `TransactionEventsService` imports from data-sync jobs to satisfy lint.
