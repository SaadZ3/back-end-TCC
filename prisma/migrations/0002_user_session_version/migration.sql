-- Permite revogar sessões no logout sem apagar dados existentes.
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
