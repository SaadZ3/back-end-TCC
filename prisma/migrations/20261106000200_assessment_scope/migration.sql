BEGIN;
ALTER TABLE "policy_analyses" ADD COLUMN "assessment_scope" JSONB;
ALTER TABLE "policy_analyses" DROP CONSTRAINT "policy_analyses_version_check";
ALTER TABLE "policy_analyses" ADD CONSTRAINT "policy_analyses_version_check"
  CHECK (("result_schema_version" = 1 AND "profile_id" IS NULL AND "supersedes_analysis_id" IS NULL AND "assessment_scope" IS NULL)
      OR ("result_schema_version" = 2 AND "profile_id" IS NOT NULL
          AND "profile_id" IN ('core-14-v1', 'documentary-18-v1') AND "assessment_scope" IS NULL)
      OR ("result_schema_version" = 3 AND "profile_id" IS NOT NULL AND "profile_id" = 'documentary-18-v1'
          AND "assessment_scope" IS NOT NULL AND jsonb_typeof("assessment_scope") = 'object'));
COMMIT;
