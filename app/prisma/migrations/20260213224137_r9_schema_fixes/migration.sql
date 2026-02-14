-- DropIndex
DROP INDEX "AuthSession_token_idx";

-- DropIndex
DROP INDEX "Conversation_offerId_idx";

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
