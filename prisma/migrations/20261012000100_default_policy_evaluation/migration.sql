-- Os registros existentes mantêm sua identidade; novos registros usam o método definitivo.
ALTER TABLE "policy_analyses"
  ALTER COLUMN "result_schema_version" SET DEFAULT 2,
  ALTER COLUMN "profile_id" SET DEFAULT 'core-14-v1';
