-- AlterTable
ALTER TABLE "Message" ADD COLUMN "iv" TEXT;

-- CreateTable
CREATE TABLE "UserEncryptionKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserEncryptionKey_address_key" ON "UserEncryptionKey"("address");
