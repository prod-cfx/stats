-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ExchangeId" AS ENUM ('binance', 'okx', 'hyperliquid');

-- CreateEnum
CREATE TYPE "public"."ExecutionStatus" AS ENUM ('PENDING', 'EXECUTED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "public"."IndicatorType" AS ENUM ('RET', 'MOVING_AVG', 'VOLATILITY', 'VOLUME_RATIO');

-- CreateEnum
CREATE TYPE "public"."InstrumentType" AS ENUM ('SPOT', 'PERPETUAL', 'FUTURE');

-- CreateEnum
CREATE TYPE "public"."LedgerEntryType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'REALIZED_PNL', 'FEE', 'FUNDING_FEE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."LlmCodegenSessionStatus" AS ENUM ('DRAFTING', 'CONFIRM_GATE', 'GENERATING', 'VALIDATING_STATIC', 'VALIDATING_RUNTIME', 'VALIDATING_OUTPUT', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."LlmStrategyInstanceMode" AS ENUM ('LIVE', 'PAPER', 'BACKTEST');

-- CreateEnum
CREATE TYPE "public"."LlmStrategyInstanceStatus" AS ENUM ('running', 'paused', 'stopped');

-- CreateEnum
CREATE TYPE "public"."LlmStrategyRunStatus" AS ENUM ('success', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "public"."LlmStrategyStatus" AS ENUM ('draft', 'live', 'archived');

-- CreateEnum
CREATE TYPE "public"."MarketTimeframe" AS ENUM ('1m', '5m', '15m', '1h', '4h', '1d');

-- CreateEnum
CREATE TYPE "public"."PositionSide" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "public"."PositionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."SignalDirection" AS ENUM ('BUY', 'SELL', 'CLOSE_LONG', 'CLOSE_SHORT');

-- CreateEnum
CREATE TYPE "public"."SignalSourceType" AS ENUM ('AI_GENERATED', 'MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."SignalStatus" AS ENUM ('PENDING', 'EXECUTED', 'PARTIAL', 'EXPIRED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."SignalType" AS ENUM ('ENTRY', 'EXIT', 'ADJUSTMENT', 'ALERT');

-- CreateEnum
CREATE TYPE "public"."StrategyInstanceMode" AS ENUM ('BACKTEST', 'PAPER', 'TESTNET', 'LIVE');

-- CreateEnum
CREATE TYPE "public"."StrategyInstanceStatus" AS ENUM ('draft', 'running', 'paused', 'stopped');

-- CreateEnum
CREATE TYPE "public"."StrategyTemplateStatus" AS ENUM ('draft', 'testing', 'live', 'disabled');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('active', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."SymbolStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "public"."SymbolType" AS ENUM ('CRYPTO', 'STOCK', 'FOREX');

-- CreateEnum
CREATE TYPE "public"."TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "public"."ai_provider_keys" (
    "id" TEXT NOT NULL,
    "provider_code" TEXT NOT NULL,
    "provider_name" TEXT,
    "base_url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "default_model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."exchange_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "exchange_id" "public"."ExchangeId" NOT NULL,
    "name" TEXT,
    "is_testnet" BOOLEAN NOT NULL DEFAULT false,
    "encrypted_config" TEXT NOT NULL,
    "last_validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."indicator_configs" (
    "id" TEXT NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "timeframe" "public"."MarketTimeframe" NOT NULL,
    "indicator_type" "public"."IndicatorType" NOT NULL,
    "name" TEXT NOT NULL,
    "params" JSONB,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicator_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."indicator_values" (
    "id" TEXT NOT NULL,
    "indicator_config_id" TEXT NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "timeframe" "public"."MarketTimeframe" NOT NULL,
    "indicator_type" "public"."IndicatorType" NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "value_numeric" DECIMAL(48,18),
    "value_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicator_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."llm_strategies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "public"."LlmStrategyStatus" NOT NULL DEFAULT 'draft',
    "system_prompt" TEXT,
    "initial_prompt_template" TEXT,
    "allowed_symbols" JSONB,
    "allowed_timeframes" JSONB,
    "risk_config" JSONB,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."llm_strategy_code_versions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "llm_strategy_id" TEXT,
    "script_code" TEXT NOT NULL,
    "spec_desc" JSONB NOT NULL,
    "static_passed" BOOLEAN NOT NULL DEFAULT false,
    "runtime_passed" BOOLEAN NOT NULL DEFAULT false,
    "output_passed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_strategy_code_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."llm_strategy_codegen_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "public"."LlmCodegenSessionStatus" NOT NULL DEFAULT 'DRAFTING',
    "checklist" JSONB,
    "constraint_pack" JSONB,
    "latest_draft_code" TEXT,
    "latest_spec_desc" JSONB,
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_strategy_codegen_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."llm_strategy_instances" (
    "id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "public"."LlmStrategyInstanceStatus" NOT NULL DEFAULT 'paused',
    "mode" "public"."LlmStrategyInstanceMode" NOT NULL DEFAULT 'PAPER',
    "llm_model" TEXT NOT NULL,
    "schedule_cron" TEXT,
    "max_tool_calls_per_run" INTEGER,
    "max_runs_per_hour" INTEGER,
    "cooldown_seconds" INTEGER,
    "config_overrides" JSONB,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "metadata" JSONB,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_strategy_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."llm_strategy_runs" (
    "id" TEXT NOT NULL,
    "strategy_instance_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "status" "public"."LlmStrategyRunStatus" NOT NULL,
    "reason" TEXT,
    "tool_calls_count" INTEGER,
    "llm_model" TEXT,
    "raw_dialog_snapshot" JSONB,
    "generated_signal_id" TEXT,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_strategy_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_bars" (
    "id" TEXT NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "timeframe" "public"."MarketTimeframe" NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(30,10) NOT NULL,
    "high" DECIMAL(30,10) NOT NULL,
    "low" DECIMAL(30,10) NOT NULL,
    "close" DECIMAL(30,10) NOT NULL,
    "volume" DECIMAL(30,12),
    "quote_volume" DECIMAL(30,12),
    "trades" INTEGER,
    "source" TEXT,
    "is_final" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_bars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_quotes" (
    "id" TEXT NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "last_price" DECIMAL(30,10) NOT NULL,
    "price_change" DECIMAL(30,10),
    "price_change_percent" DECIMAL(18,8),
    "open_price" DECIMAL(30,10),
    "high_price" DECIMAL(30,10),
    "low_price" DECIMAL(30,10),
    "volume" DECIMAL(30,12),
    "quote_volume" DECIMAL(30,12),
    "bid_price" DECIMAL(30,10),
    "bid_qty" DECIMAL(30,12),
    "ask_price" DECIMAL(30,10),
    "ask_qty" DECIMAL(30,12),
    "event_time" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_symbols" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "base_asset" TEXT NOT NULL,
    "quote_asset" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "type" "public"."SymbolType" NOT NULL DEFAULT 'CRYPTO',
    "instrument_type" "public"."InstrumentType" NOT NULL DEFAULT 'SPOT',
    "status" "public"."SymbolStatus" NOT NULL DEFAULT 'ACTIVE',
    "precision_price" INTEGER NOT NULL DEFAULT 2,
    "precision_quantity" INTEGER NOT NULL DEFAULT 6,
    "tick_size" DECIMAL(65,30),
    "lot_size" DECIMAL(65,30),
    "is_margin_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_symbols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pnl_ledger" (
    "id" TEXT NOT NULL,
    "user_strategy_account_id" TEXT NOT NULL,
    "position_id" TEXT,
    "type" "public"."LedgerEntryType" NOT NULL,
    "amount" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "balance_after" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "reference_id" TEXT,
    "description" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pnl_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."position_sync_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_strategy_account_id" TEXT,
    "exchange_id" TEXT NOT NULL,
    "market_type" TEXT NOT NULL,
    "sync_type" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "exchange_positions" INTEGER NOT NULL DEFAULT 0,
    "local_positions" INTEGER NOT NULL DEFAULT 0,
    "differences_count" INTEGER NOT NULL DEFAULT 0,
    "differences" JSONB,
    "errors" JSONB,
    "duration_ms" INTEGER,
    "triggered_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."positions" (
    "id" TEXT NOT NULL,
    "user_strategy_account_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "position_side" "public"."PositionSide" NOT NULL,
    "leverage" DECIMAL(18,8),
    "quantity" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "avg_entry_price" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "realized_pnl" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "unrealized_pnl" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "status" "public"."PositionStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "exchange_id" TEXT,
    "market_type" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."strategy_instances" (
    "id" TEXT NOT NULL,
    "strategy_template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "llm_model" TEXT NOT NULL,
    "params" JSONB,
    "status" "public"."StrategyInstanceStatus" NOT NULL DEFAULT 'draft',
    "mode" "public"."StrategyInstanceMode" NOT NULL DEFAULT 'PAPER',
    "started_at" TIMESTAMP(3),
    "stopped_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."strategy_pnl_daily" (
    "id" TEXT NOT NULL,
    "user_strategy_account_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "equity_start" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "equity_end" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "realized_pnl" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "unrealized_pnl" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "deposits" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "withdrawals" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "max_drawdown" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_pnl_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."strategy_signal_state" (
    "strategy_id" TEXT NOT NULL,
    "strategy_instance_id" TEXT NOT NULL,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_strategy_signal_state" PRIMARY KEY ("strategy_id","strategy_instance_id")
);

-- CreateTable
CREATE TABLE "public"."strategy_signals" (
    "id" TEXT NOT NULL,
    "strategy_id" TEXT,
    "strategy_instance_id" TEXT,
    "llm_strategy_id" TEXT,
    "llm_strategy_instance_id" TEXT,
    "symbol_id" TEXT NOT NULL,
    "source_type" "public"."SignalSourceType" NOT NULL DEFAULT 'AI_GENERATED',
    "signal_type" "public"."SignalType" NOT NULL,
    "direction" "public"."SignalDirection" NOT NULL,
    "confidence" DECIMAL(5,2),
    "entry_price" DECIMAL(30,10),
    "target_price" DECIMAL(30,10),
    "stop_loss" DECIMAL(30,10),
    "take_profit" DECIMAL(30,10),
    "position_size_quote" DECIMAL(30,10),
    "position_size_ratio" DECIMAL(5,4),
    "ai_model" TEXT,
    "ai_reasoning" TEXT,
    "ai_raw_response" JSONB,
    "market_context" JSONB,
    "metadata" JSONB,
    "status" "public"."SignalStatus" NOT NULL DEFAULT 'PENDING',
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."strategy_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "legs" JSONB,
    "execution" JSONB,
    "data_requirements" JSONB,
    "llm_model" TEXT NOT NULL,
    "prompt_template" TEXT NOT NULL,
    "script" TEXT,
    "params_schema" JSONB NOT NULL,
    "default_params" JSONB,
    "rules_json" JSONB,
    "required_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rules_version" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."StrategyTemplateStatus" NOT NULL DEFAULT 'draft',
    "created_by" TEXT,
    "updated_by" TEXT,
    "last_generation_summary" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."trades" (
    "id" TEXT NOT NULL,
    "user_strategy_account_id" TEXT NOT NULL,
    "position_id" TEXT,
    "symbol" TEXT NOT NULL,
    "market" TEXT,
    "side" "public"."TradeSide" NOT NULL,
    "position_side" "public"."PositionSide" NOT NULL,
    "price" DECIMAL(48,18) NOT NULL,
    "quantity" DECIMAL(48,18) NOT NULL,
    "fee" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "fee_currency" TEXT,
    "order_id" TEXT,
    "external_trade_id" TEXT,
    "provider" TEXT,
    "executed_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_llm_strategy_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "llm_strategy_instance_id" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'active',
    "custom_params" JSONB,
    "exchange_account_id" TEXT,
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_llm_strategy_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_signal_executions" (
    "id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_strategy_account_id" TEXT NOT NULL,
    "status" "public"."ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "order_side" "public"."TradeSide" NOT NULL,
    "position_side" "public"."PositionSide" NOT NULL,
    "executed_price" DECIMAL(48,18),
    "executed_quantity" DECIMAL(48,18),
    "fee" DECIMAL(48,18),
    "fee_currency" TEXT,
    "trade_id" TEXT,
    "position_id" TEXT,
    "executed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "metadata" JSONB,
    "reserved_quote" DECIMAL(48,18),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_signal_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_strategy_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "strategy_name" TEXT,
    "strategy_version" TEXT,
    "base_currency" TEXT NOT NULL,
    "initial_balance" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "balance" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "equity" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "total_realized_pnl" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "total_unrealized_pnl" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "last_equity_recalc_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_strategy_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_strategy_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "strategy_instance_id" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'active',
    "custom_params" JSONB,
    "exchange_account_id" TEXT,
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_strategy_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nickname" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT,
    "invitation_code" TEXT,
    "inviter_id" TEXT,
    "is_guest" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ai_provider_provider_status" ON "public"."ai_provider_keys"("provider_code" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_ai_provider_code_name" ON "public"."ai_provider_keys"("provider_code" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "idx_exchange_accounts_user" ON "public"."exchange_accounts"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_exchange_accounts_user_exchange_name" ON "public"."exchange_accounts"("user_id" ASC, "exchange_id" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "idx_indicator_config_symbol_timeframe_type" ON "public"."indicator_configs"("symbol_id" ASC, "timeframe" ASC, "indicator_type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_indicator_config_symbol_timeframe_type_name" ON "public"."indicator_configs"("symbol_id" ASC, "timeframe" ASC, "indicator_type" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "idx_indicator_values_config_time" ON "public"."indicator_values"("indicator_config_id" ASC, "time" ASC);

-- CreateIndex
CREATE INDEX "idx_indicator_values_symbol_timeframe_type_time" ON "public"."indicator_values"("symbol_id" ASC, "timeframe" ASC, "indicator_type" ASC, "time" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_indicator_values_config_time" ON "public"."indicator_values"("indicator_config_id" ASC, "time" ASC);

-- CreateIndex
CREATE INDEX "idx_llm_strategies_created_by_created_at" ON "public"."llm_strategies"("created_by" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_llm_strategies_status" ON "public"."llm_strategies"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "llm_strategies_name_key" ON "public"."llm_strategies"("name" ASC);

-- CreateIndex
CREATE INDEX "idx_llm_code_versions_session_created_at" ON "public"."llm_strategy_code_versions"("session_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_llm_code_versions_strategy_created_at" ON "public"."llm_strategy_code_versions"("llm_strategy_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_llm_codegen_sessions_status_created_at" ON "public"."llm_strategy_codegen_sessions"("status" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_llm_codegen_sessions_user_status_created_at" ON "public"."llm_strategy_codegen_sessions"("user_id" ASC, "status" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_llm_strategy_instances_created_by_created_at" ON "public"."llm_strategy_instances"("created_by" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_llm_strategy_instances_status" ON "public"."llm_strategy_instances"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_llm_strategy_instances_strategy_created_by_created_at" ON "public"."llm_strategy_instances"("strategy_id" ASC, "created_by" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_llm_strategy_instances_strategy_status" ON "public"."llm_strategy_instances"("strategy_id" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_llm_strategy_instance_per_strategy" ON "public"."llm_strategy_instances"("strategy_id" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "idx_llm_strategy_runs_instance_time" ON "public"."llm_strategy_runs"("strategy_instance_id" ASC, "started_at" ASC);

-- CreateIndex
CREATE INDEX "idx_llm_strategy_runs_signal" ON "public"."llm_strategy_runs"("generated_signal_id" ASC);

-- CreateIndex
CREATE INDEX "idx_llm_strategy_runs_status" ON "public"."llm_strategy_runs"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_market_bars_symbol_timeframe_time" ON "public"."market_bars"("symbol_id" ASC, "timeframe" ASC, "time" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_market_bars_symbol_timeframe_time" ON "public"."market_bars"("symbol_id" ASC, "timeframe" ASC, "time" ASC);

-- CreateIndex
CREATE INDEX "idx_market_quotes_symbol" ON "public"."market_quotes"("symbol_id" ASC);

-- CreateIndex
CREATE INDEX "idx_market_quotes_symbol_event_time" ON "public"."market_quotes"("symbol_id" ASC, "event_time" ASC);

-- CreateIndex
CREATE INDEX "idx_symbols_exchange_status_type" ON "public"."market_symbols"("exchange" ASC, "status" ASC, "instrument_type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "market_symbols_code_key" ON "public"."market_symbols"("code" ASC);

-- CreateIndex
CREATE INDEX "idx_ledger_account_time" ON "public"."pnl_ledger"("user_strategy_account_id" ASC, "occurred_at" ASC);

-- CreateIndex
CREATE INDEX "idx_ledger_type_time" ON "public"."pnl_ledger"("type" ASC, "occurred_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_ledger_reference_per_account" ON "public"."pnl_ledger"("user_strategy_account_id" ASC, "reference_id" ASC);

-- CreateIndex
CREATE INDEX "idx_position_sync_log_account_time" ON "public"."position_sync_logs"("user_strategy_account_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_position_sync_log_success_time" ON "public"."position_sync_logs"("success" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_position_sync_log_user_time" ON "public"."position_sync_logs"("user_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_position_account_status" ON "public"."positions"("user_strategy_account_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_position_symbol_status" ON "public"."positions"("symbol" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_strategy_instance_created_at" ON "public"."strategy_instances"("created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_strategy_instance_mode" ON "public"."strategy_instances"("mode" ASC);

-- CreateIndex
CREATE INDEX "idx_strategy_instance_status" ON "public"."strategy_instances"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_strategy_instance_template_status" ON "public"."strategy_instances"("strategy_template_id" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_strategy_instance_template_model_name" ON "public"."strategy_instances"("strategy_template_id" ASC, "llm_model" ASC, "name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_strategy_pnl_daily" ON "public"."strategy_pnl_daily"("user_strategy_account_id" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_strategy_signal_state_instance" ON "public"."strategy_signal_state"("strategy_instance_id" ASC);

-- CreateIndex
CREATE INDEX "idx_strategy_signals_instance_created" ON "public"."strategy_signals"("strategy_instance_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_strategy_signals_llm_instance_created" ON "public"."strategy_signals"("llm_strategy_instance_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_strategy_signals_llm_strategy_created" ON "public"."strategy_signals"("llm_strategy_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_strategy_signals_status_created" ON "public"."strategy_signals"("status" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_strategy_signals_strategy_created" ON "public"."strategy_signals"("strategy_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_strategy_signals_symbol_created" ON "public"."strategy_signals"("symbol_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_strategy_templates_created_at" ON "public"."strategy_templates"("created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_strategy_templates_status" ON "public"."strategy_templates"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "strategy_templates_name_key" ON "public"."strategy_templates"("name" ASC);

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "public"."system_settings"("category" ASC);

-- CreateIndex
CREATE INDEX "system_settings_is_system_idx" ON "public"."system_settings"("is_system" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "public"."system_settings"("key" ASC);

-- CreateIndex
CREATE INDEX "idx_trade_account_time" ON "public"."trades"("user_strategy_account_id" ASC, "executed_at" ASC);

-- CreateIndex
CREATE INDEX "idx_trade_symbol_time" ON "public"."trades"("symbol" ASC, "executed_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_trade_external_id_per_account" ON "public"."trades"("user_strategy_account_id" ASC, "external_trade_id" ASC);

-- CreateIndex
CREATE INDEX "idx_user_llm_strategy_subscription_instance_status" ON "public"."user_llm_strategy_subscriptions"("llm_strategy_instance_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_user_llm_strategy_subscription_user_status" ON "public"."user_llm_strategy_subscriptions"("user_id" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_user_llm_strategy_subscription" ON "public"."user_llm_strategy_subscriptions"("user_id" ASC, "llm_strategy_instance_id" ASC);

-- CreateIndex
CREATE INDEX "idx_signal_exec_account_created" ON "public"."user_signal_executions"("user_strategy_account_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_signal_exec_signal" ON "public"."user_signal_executions"("signal_id" ASC);

-- CreateIndex
CREATE INDEX "idx_signal_exec_user_created" ON "public"."user_signal_executions"("user_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_signal_exec_per_account" ON "public"."user_signal_executions"("signal_id" ASC, "user_strategy_account_id" ASC);

-- CreateIndex
CREATE INDEX "idx_user_strategy_account_strategy" ON "public"."user_strategy_accounts"("strategy_id" ASC);

-- CreateIndex
CREATE INDEX "idx_user_strategy_account_user" ON "public"."user_strategy_accounts"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_user_strategy_account" ON "public"."user_strategy_accounts"("user_id" ASC, "strategy_id" ASC);

-- CreateIndex
CREATE INDEX "idx_user_strategy_subscription_instance_status" ON "public"."user_strategy_subscriptions"("strategy_instance_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_user_strategy_subscription_user_status" ON "public"."user_strategy_subscriptions"("user_id" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_user_strategy_subscription" ON "public"."user_strategy_subscriptions"("user_id" ASC, "strategy_instance_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."exchange_accounts" ADD CONSTRAINT "exchange_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."indicator_configs" ADD CONSTRAINT "indicator_configs_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "public"."market_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."indicator_values" ADD CONSTRAINT "indicator_values_indicator_config_id_fkey" FOREIGN KEY ("indicator_config_id") REFERENCES "public"."indicator_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."indicator_values" ADD CONSTRAINT "indicator_values_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "public"."market_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."llm_strategy_code_versions" ADD CONSTRAINT "llm_strategy_code_versions_llm_strategy_id_fkey" FOREIGN KEY ("llm_strategy_id") REFERENCES "public"."llm_strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."llm_strategy_code_versions" ADD CONSTRAINT "llm_strategy_code_versions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."llm_strategy_codegen_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."llm_strategy_instances" ADD CONSTRAINT "llm_strategy_instances_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "public"."llm_strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."llm_strategy_runs" ADD CONSTRAINT "llm_strategy_runs_generated_signal_id_fkey" FOREIGN KEY ("generated_signal_id") REFERENCES "public"."strategy_signals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."llm_strategy_runs" ADD CONSTRAINT "llm_strategy_runs_strategy_instance_id_fkey" FOREIGN KEY ("strategy_instance_id") REFERENCES "public"."llm_strategy_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_bars" ADD CONSTRAINT "market_bars_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "public"."market_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_quotes" ADD CONSTRAINT "market_quotes_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "public"."market_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pnl_ledger" ADD CONSTRAINT "pnl_ledger_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pnl_ledger" ADD CONSTRAINT "pnl_ledger_user_strategy_account_id_fkey" FOREIGN KEY ("user_strategy_account_id") REFERENCES "public"."user_strategy_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."positions" ADD CONSTRAINT "positions_user_strategy_account_id_fkey" FOREIGN KEY ("user_strategy_account_id") REFERENCES "public"."user_strategy_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."strategy_instances" ADD CONSTRAINT "strategy_instances_strategy_template_id_fkey" FOREIGN KEY ("strategy_template_id") REFERENCES "public"."strategy_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."strategy_pnl_daily" ADD CONSTRAINT "strategy_pnl_daily_user_strategy_account_id_fkey" FOREIGN KEY ("user_strategy_account_id") REFERENCES "public"."user_strategy_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."strategy_signal_state" ADD CONSTRAINT "strategy_signal_state_strategy_instance_id_fkey" FOREIGN KEY ("strategy_instance_id") REFERENCES "public"."strategy_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."strategy_signals" ADD CONSTRAINT "strategy_signals_llm_strategy_id_fkey" FOREIGN KEY ("llm_strategy_id") REFERENCES "public"."llm_strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."strategy_signals" ADD CONSTRAINT "strategy_signals_llm_strategy_instance_id_fkey" FOREIGN KEY ("llm_strategy_instance_id") REFERENCES "public"."llm_strategy_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."strategy_signals" ADD CONSTRAINT "strategy_signals_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategy_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."strategy_signals" ADD CONSTRAINT "strategy_signals_strategy_instance_id_fkey" FOREIGN KEY ("strategy_instance_id") REFERENCES "public"."strategy_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."strategy_signals" ADD CONSTRAINT "strategy_signals_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "public"."market_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."trades" ADD CONSTRAINT "trades_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."trades" ADD CONSTRAINT "trades_user_strategy_account_id_fkey" FOREIGN KEY ("user_strategy_account_id") REFERENCES "public"."user_strategy_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_llm_strategy_subscriptions" ADD CONSTRAINT "user_llm_strategy_subscriptions_exchange_account_id_fkey" FOREIGN KEY ("exchange_account_id") REFERENCES "public"."exchange_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_llm_strategy_subscriptions" ADD CONSTRAINT "user_llm_strategy_subscriptions_llm_strategy_instance_id_fkey" FOREIGN KEY ("llm_strategy_instance_id") REFERENCES "public"."llm_strategy_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_llm_strategy_subscriptions" ADD CONSTRAINT "user_llm_strategy_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_signal_executions" ADD CONSTRAINT "user_signal_executions_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "public"."strategy_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_signal_executions" ADD CONSTRAINT "user_signal_executions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_signal_executions" ADD CONSTRAINT "user_signal_executions_user_strategy_account_id_fkey" FOREIGN KEY ("user_strategy_account_id") REFERENCES "public"."user_strategy_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_strategy_accounts" ADD CONSTRAINT "user_strategy_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_strategy_subscriptions" ADD CONSTRAINT "user_strategy_subscriptions_exchange_account_id_fkey" FOREIGN KEY ("exchange_account_id") REFERENCES "public"."exchange_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_strategy_subscriptions" ADD CONSTRAINT "user_strategy_subscriptions_strategy_instance_id_fkey" FOREIGN KEY ("strategy_instance_id") REFERENCES "public"."strategy_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_strategy_subscriptions" ADD CONSTRAINT "user_strategy_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
