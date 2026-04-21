DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'LlmCodegenSessionStatus'
      AND e.enumlabel = 'CHECKLIST_GATE'
  ) THEN
    EXECUTE 'ALTER TYPE "public"."LlmCodegenSessionStatus" RENAME VALUE ''CHECKLIST_GATE'' TO ''CONFIRM_GATE''';
  END IF;
END $$;
