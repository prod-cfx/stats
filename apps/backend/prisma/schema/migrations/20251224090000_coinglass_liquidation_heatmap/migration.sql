-- CreateEnum
CREATE TYPE "LiquidationHeatmapSource" AS ENUM ('COINGLASS');

-- CreateEnum
CREATE TYPE "LiquidationHeatmapModelType" AS ENUM ('MODEL1', 'MODEL2', 'MODEL3');

-- CreateTable
CREATE TABLE "liquidation_heatmap_snapshots" (
    "id" SERIAL NOT NULL,
    "source" "LiquidationHeatmapSource" NOT NULL DEFAULT 'COINGLASS',
    "model_type" "LiquidationHeatmapModelType" NOT NULL DEFAULT 'MODEL3',
    "exchange_code" TEXT,
    "symbol" TEXT NOT NULL,
    "trading_pair" TEXT,
    "contract_type" TEXT,
    "time_interval" TEXT,
    "value_currency" TEXT NOT NULL DEFAULT 'USD',
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_payload" JSONB,

    CONSTRAINT "liquidation_heatmap_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidation_heatmap_y_axes" (
    "id" SERIAL NOT NULL,
    "snapshot_id" INTEGER NOT NULL,
    "axis_index" INTEGER NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "liquidation_heatmap_y_axes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidation_heatmap_candles" (
    "id" SERIAL NOT NULL,
    "snapshot_id" INTEGER NOT NULL,
    "candle_index" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(65,30) NOT NULL,
    "high" DECIMAL(65,30) NOT NULL,
    "low" DECIMAL(65,30) NOT NULL,
    "close" DECIMAL(65,30) NOT NULL,
    "volume" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "liquidation_heatmap_candles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidation_heatmap_cells" (
    "id" SERIAL NOT NULL,
    "snapshot_id" INTEGER NOT NULL,
    "x_index" INTEGER NOT NULL,
    "y_index" INTEGER NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "value_currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "liquidation_heatmap_cells_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "liquidation_heatmap_snapshots_symbol_exchange_code_contract_type_idx"
  ON "liquidation_heatmap_snapshots"("symbol", "exchange_code", "contract_type");

-- CreateIndex
CREATE INDEX "liquidation_heatmap_snapshots_fetched_at_idx"
  ON "liquidation_heatmap_snapshots"("fetched_at");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_heatmap_y_axis"
  ON "liquidation_heatmap_y_axes"("snapshot_id", "axis_index");

-- CreateIndex
CREATE INDEX "liquidation_heatmap_y_axes_snapshot_id_idx"
  ON "liquidation_heatmap_y_axes"("snapshot_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_heatmap_candle_idx"
  ON "liquidation_heatmap_candles"("snapshot_id", "candle_index");

-- CreateIndex
CREATE INDEX "liquidation_heatmap_candles_snapshot_id_idx"
  ON "liquidation_heatmap_candles"("snapshot_id");

-- CreateIndex
CREATE INDEX "liquidation_heatmap_candles_timestamp_idx"
  ON "liquidation_heatmap_candles"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_heatmap_cell"
  ON "liquidation_heatmap_cells"("snapshot_id", "x_index", "y_index");

-- CreateIndex
CREATE INDEX "idx_heatmap_cell_x"
  ON "liquidation_heatmap_cells"("snapshot_id", "x_index");

-- CreateIndex
CREATE INDEX "idx_heatmap_cell_y"
  ON "liquidation_heatmap_cells"("snapshot_id", "y_index");

-- AddForeignKey
ALTER TABLE "liquidation_heatmap_y_axes"
  ADD CONSTRAINT "liquidation_heatmap_y_axes_snapshot_id_fkey"
  FOREIGN KEY ("snapshot_id") REFERENCES "liquidation_heatmap_snapshots"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidation_heatmap_candles"
  ADD CONSTRAINT "liquidation_heatmap_candles_snapshot_id_fkey"
  FOREIGN KEY ("snapshot_id") REFERENCES "liquidation_heatmap_snapshots"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidation_heatmap_cells"
  ADD CONSTRAINT "liquidation_heatmap_cells_snapshot_id_fkey"
  FOREIGN KEY ("snapshot_id") REFERENCES "liquidation_heatmap_snapshots"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;


