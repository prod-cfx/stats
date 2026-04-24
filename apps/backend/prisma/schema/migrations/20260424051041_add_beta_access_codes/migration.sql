-- CreateTable
CREATE TABLE "beta_access_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "max_uses" INTEGER NOT NULL,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beta_access_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beta_access_code_redemptions" (
    "id" TEXT NOT NULL,
    "code_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beta_access_code_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "beta_access_codes_code_key" ON "beta_access_codes"("code");

-- CreateIndex
CREATE INDEX "idx_beta_access_codes_active_created" ON "beta_access_codes"("is_active", "created_at");

-- CreateIndex
CREATE INDEX "idx_beta_access_code_redemptions_code" ON "beta_access_code_redemptions"("code_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_beta_access_code_redemptions_user" ON "beta_access_code_redemptions"("user_id");

-- AddForeignKey
ALTER TABLE "beta_access_code_redemptions" ADD CONSTRAINT "beta_access_code_redemptions_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "beta_access_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beta_access_code_redemptions" ADD CONSTRAINT "beta_access_code_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
