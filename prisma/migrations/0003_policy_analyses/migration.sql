CREATE TYPE "PolicyAnalysisStatus" AS ENUM ('processing', 'completed', 'failed');

CREATE TABLE "policy_analyses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_sha256" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pt',
    "document_scope" TEXT NOT NULL,
    "status" "PolicyAnalysisStatus" NOT NULL DEFAULT 'processing',
    "versions" JSONB,
    "result" JSONB,
    "error" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "policy_analyses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "policy_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "policy_analyses_storage_key_key" ON "policy_analyses"("storage_key");
CREATE INDEX "policy_analyses_user_id_created_at_id_idx" ON "policy_analyses"("user_id", "created_at", "id");
