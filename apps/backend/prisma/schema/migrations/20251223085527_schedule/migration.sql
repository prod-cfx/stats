-- CreateEnum
CREATE TYPE "PrincipalType" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AdminMenuType" AS ENUM ('DIRECTORY', 'MENU', 'FEATURE');

-- CreateEnum
CREATE TYPE "UserCredentialType" AS ENUM ('email');

-- CreateEnum
CREATE TYPE "VerificationCodePurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "menu_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feature_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "api_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" TEXT NOT NULL,
    "principal_id" TEXT NOT NULL,
    "principal_type" "PrincipalType" NOT NULL DEFAULT 'USER',
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nick_name" TEXT,
    "email" TEXT,
    "avatar_url" TEXT,
    "phone" VARCHAR(20),
    "is_frozen" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_menus" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "type" "AdminMenuType" NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT,
    "code" TEXT,
    "path" TEXT,
    "description" TEXT,
    "i18n_key" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "is_show" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_pull_tasks" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT,
    "type" TEXT,
    "cron" TEXT,
    "interval_seconds" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cursor" TEXT,
    "last_status" TEXT,
    "last_run_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_error" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_pull_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_pull_executions" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "fetched_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "meta" JSONB,

    CONSTRAINT "data_pull_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
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
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nickname" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT,
    "invitation_code" TEXT,
    "inviter_id" TEXT,
    "is_guest" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMP(3),
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "UserCredentialType" NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" "VerificationCodePurpose" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "idx_role_assignment_principal" ON "role_assignments"("principal_id", "principal_type");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_role_assignment" ON "role_assignments"("principal_id", "principal_type", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- CreateIndex
CREATE INDEX "admin_users_username_idx" ON "admin_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "admin_menus_code_key" ON "admin_menus"("code");

-- CreateIndex
CREATE INDEX "admin_menus_parent_id_idx" ON "admin_menus"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_menus_parent_id_title_key" ON "admin_menus"("parent_id", "title");

-- CreateIndex
CREATE UNIQUE INDEX "data_pull_tasks_key_key" ON "data_pull_tasks"("key");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");

-- CreateIndex
CREATE INDEX "system_settings_is_system_idx" ON "system_settings"("is_system");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_user_credentials_user" ON "user_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_user_credentials_type_value" ON "user_credentials"("type", "value");

-- CreateIndex
CREATE INDEX "idx_verification_code_email_purpose" ON "verification_codes"("email", "purpose");

-- CreateIndex
CREATE INDEX "idx_verification_code_code_purpose" ON "verification_codes"("code", "purpose");

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_menus" ADD CONSTRAINT "admin_menus_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "admin_menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_pull_executions" ADD CONSTRAINT "data_pull_executions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "data_pull_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
