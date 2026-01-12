-- AlterTable
ALTER TABLE "crypto_stock_quotes" ADD COLUMN     "company_type" TEXT,
ADD COLUMN     "holding_quantity" DECIMAL(30,10),
ADD COLUMN     "holding_value" DECIMAL(30,10),
ADD COLUMN     "m_nav" DECIMAL(30,10);
