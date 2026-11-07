-- Aceita o novo perfil sem recalcular ou regravar análises históricas.
ALTER TABLE "policy_analyses" DROP CONSTRAINT "policy_analyses_version_check";
ALTER TABLE "policy_analyses" ADD CONSTRAINT "policy_analyses_version_check"
  CHECK (("result_schema_version" = 1 AND "profile_id" IS NULL AND "supersedes_analysis_id" IS NULL)
      OR ("result_schema_version" = 2 AND "profile_id" IS NOT NULL
          AND "profile_id" IN ('core-14-v1', 'documentary-18-v1')));
ALTER TABLE "policy_analyses" ALTER COLUMN "profile_id" SET DEFAULT 'documentary-18-v1';
