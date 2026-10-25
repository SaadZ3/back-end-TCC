-- Recusa contas legadas ambíguas sem apagar ou mesclar usuários.
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users" (LOWER(BTRIM("email")));

-- Excluir uma análise preserva suas reanálises, retirando apenas o vínculo.
ALTER TABLE "policy_analyses" DROP CONSTRAINT "policy_analyses_supersedes_analysis_id_fkey";
ALTER TABLE "policy_analyses" ADD CONSTRAINT "policy_analyses_supersedes_analysis_id_fkey"
  FOREIGN KEY ("supersedes_analysis_id") REFERENCES "policy_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
