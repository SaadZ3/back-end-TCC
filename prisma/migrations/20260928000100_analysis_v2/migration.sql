ALTER TABLE "policy_analyses"
  ADD COLUMN "result_schema_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "profile_id" TEXT,
  ADD COLUMN "supersedes_analysis_id" TEXT;

ALTER TABLE "policy_analyses" ADD CONSTRAINT "policy_analyses_version_check"
  CHECK (("result_schema_version" = 1 AND "profile_id" IS NULL AND "supersedes_analysis_id" IS NULL)
      OR ("result_schema_version" = 2 AND "profile_id" IS NOT NULL AND "profile_id" = 'core-14-v1'));
ALTER TABLE "policy_analyses" ADD CONSTRAINT "policy_analyses_no_self_revision"
  CHECK ("supersedes_analysis_id" IS DISTINCT FROM "id");
ALTER TABLE "policy_analyses" ADD CONSTRAINT "policy_analyses_supersedes_analysis_id_fkey"
  FOREIGN KEY ("supersedes_analysis_id") REFERENCES "policy_analyses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "policy_analyses_supersedes_analysis_id_idx" ON "policy_analyses"("supersedes_analysis_id");
