-- CreateEnum
CREATE TYPE "GridRuntimeStatus" AS ENUM ('CREATED', 'INITIALIZING', 'RUNNING', 'PAUSING', 'PAUSED', 'STOPPING', 'STOPPED', 'RECONCILE_REQUIRED', 'ERROR', 'TERMINATED');

-- CreateEnum
CREATE TYPE "GridOrderStatus" AS ENUM ('PLANNED', 'SUBMITTING', 'OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELING', 'CANCELED', 'REJECTED', 'STALE');

-- AlterTable
ALTER TABLE "outbox_message" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "published_strategy_snapshots" ALTER COLUMN "user_intent_summary" DROP DEFAULT,
ALTER COLUMN "strategy_summary" DROP DEFAULT,
ALTER COLUMN "script_summary" DROP DEFAULT,
ALTER COLUMN "locked_params" DROP DEFAULT;

-- CreateTable
CREATE TABLE "grid_runtime_instances" (
    "id" TEXT NOT NULL,
    "strategy_instance_id" TEXT NOT NULL,
    "published_snapshot_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "exchange_account_id" TEXT NOT NULL,
    "exchange_id" TEXT NOT NULL,
    "market_type" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" "GridRuntimeStatus" NOT NULL DEFAULT 'CREATED',
    "config_snapshot" JSONB NOT NULL,
    "stop_reason" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grid_runtime_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grid_levels" (
    "id" TEXT NOT NULL,
    "grid_runtime_instance_id" TEXT NOT NULL,
    "level_index" INTEGER NOT NULL,
    "price" DECIMAL(48,18) NOT NULL,
    "side" TEXT NOT NULL,
    "role" TEXT,
    "base_quantity" DECIMAL(48,18),
    "quote_budget" DECIMAL(48,18),
    "status" TEXT NOT NULL,
    "open_order_id" TEXT,
    "open_client_order_id" TEXT,
    "open_exchange_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grid_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grid_orders" (
    "id" TEXT NOT NULL,
    "grid_runtime_instance_id" TEXT NOT NULL,
    "grid_level_id" TEXT NOT NULL,
    "client_order_id" TEXT,
    "exchange_order_id" TEXT,
    "side" TEXT NOT NULL,
    "order_type" TEXT NOT NULL,
    "time_in_force" TEXT NOT NULL,
    "price" DECIMAL(48,18) NOT NULL,
    "quantity" DECIMAL(48,18) NOT NULL,
    "filled_quantity" DECIMAL(48,18) NOT NULL DEFAULT 0,
    "avg_fill_price" DECIMAL(48,18),
    "status" "GridOrderStatus" NOT NULL DEFAULT 'PLANNED',
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grid_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grid_fills" (
    "id" TEXT NOT NULL,
    "grid_runtime_instance_id" TEXT NOT NULL,
    "grid_order_id" TEXT NOT NULL,
    "exchange_fill_id" TEXT,
    "trade_id" TEXT,
    "side" TEXT NOT NULL,
    "price" DECIMAL(48,18) NOT NULL,
    "quantity" DECIMAL(48,18) NOT NULL,
    "fee" DECIMAL(48,18),
    "fee_currency" TEXT,
    "filled_at" TIMESTAMP(3) NOT NULL,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grid_fills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grid_runtime_events" (
    "id" TEXT NOT NULL,
    "grid_runtime_instance_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT,
    "message" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grid_runtime_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_grid_runtime_user_created" ON "grid_runtime_instances"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_grid_runtime_strategy_instance" ON "grid_runtime_instances"("strategy_instance_id");

-- CreateIndex
CREATE INDEX "idx_grid_levels_instance" ON "grid_levels"("grid_runtime_instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_grid_level_instance_index" ON "grid_levels"("grid_runtime_instance_id", "level_index");

-- CreateIndex
CREATE INDEX "idx_grid_orders_instance_created" ON "grid_orders"("grid_runtime_instance_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_grid_orders_instance" ON "grid_orders"("grid_runtime_instance_id");

-- CreateIndex
CREATE INDEX "idx_grid_orders_client_order" ON "grid_orders"("client_order_id");

-- CreateIndex
CREATE INDEX "idx_grid_orders_exchange_order" ON "grid_orders"("exchange_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_grid_order_instance_client_order" ON "grid_orders"("grid_runtime_instance_id", "client_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_grid_order_instance_exchange_order" ON "grid_orders"("grid_runtime_instance_id", "exchange_order_id");

-- CreateIndex
CREATE INDEX "idx_grid_fills_instance_created" ON "grid_fills"("grid_runtime_instance_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_grid_fills_instance_filled" ON "grid_fills"("grid_runtime_instance_id", "filled_at");

-- CreateIndex
CREATE INDEX "idx_grid_fills_instance" ON "grid_fills"("grid_runtime_instance_id");

-- CreateIndex
CREATE INDEX "idx_grid_fills_exchange_fill" ON "grid_fills"("exchange_fill_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_grid_fill_instance_exchange_fill" ON "grid_fills"("grid_runtime_instance_id", "exchange_fill_id");

-- CreateIndex
CREATE INDEX "idx_grid_runtime_events_instance_created" ON "grid_runtime_events"("grid_runtime_instance_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_grid_runtime_events_instance" ON "grid_runtime_events"("grid_runtime_instance_id");

-- AddForeignKey
ALTER TABLE "grid_levels" ADD CONSTRAINT "grid_levels_grid_runtime_instance_id_fkey" FOREIGN KEY ("grid_runtime_instance_id") REFERENCES "grid_runtime_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grid_orders" ADD CONSTRAINT "grid_orders_grid_runtime_instance_id_fkey" FOREIGN KEY ("grid_runtime_instance_id") REFERENCES "grid_runtime_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grid_orders" ADD CONSTRAINT "grid_orders_grid_level_id_fkey" FOREIGN KEY ("grid_level_id") REFERENCES "grid_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grid_fills" ADD CONSTRAINT "grid_fills_grid_runtime_instance_id_fkey" FOREIGN KEY ("grid_runtime_instance_id") REFERENCES "grid_runtime_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grid_fills" ADD CONSTRAINT "grid_fills_grid_order_id_fkey" FOREIGN KEY ("grid_order_id") REFERENCES "grid_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grid_runtime_events" ADD CONSTRAINT "grid_runtime_events_grid_runtime_instance_id_fkey" FOREIGN KEY ("grid_runtime_instance_id") REFERENCES "grid_runtime_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
