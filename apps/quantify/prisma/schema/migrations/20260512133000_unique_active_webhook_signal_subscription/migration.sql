CREATE UNIQUE INDEX "uniq_webhook_signal_subscriptions_active_instance_signal"
ON "webhook_signal_subscriptions" ("strategy_instance_id", "signal_id")
WHERE "status" = 'ACTIVE';
